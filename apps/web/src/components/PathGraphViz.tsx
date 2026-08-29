'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { EntityRecord, GraphPath, RelationshipRecord } from '@graph-rag/shared';

type VizNode = {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
};

type VizEdge = {
  id: string;
  type: string;
  sourceId: string;
  targetId: string;
  evidence?: string;
  confidence?: number;
  pathIds: string[];
};

type Props = {
  paths: GraphPath[];
  entities: EntityRecord[];
  selectedPathId: string | null;
  onSelectPath: (id: string | null) => void;
  width?: number;
  height?: number;
};

const DEFAULT_WIDTH = 560;
const DEFAULT_HEIGHT = 400;
const PAD_X = 72;
const PAD_Y = 56;
const NODE_R = 16;

const TYPE_COLORS: Record<string, string> = {
  Person: '#38bdf8',
  Organization: '#a78bfa',
  Product: '#34d399',
  Concept: '#fbbf24',
  Location: '#fb7185',
  Event: '#94a3b8',
};

function colorForType(type: string): string {
  return TYPE_COLORS[type] ?? '#94a3b8';
}

function buildGraph(
  paths: GraphPath[],
  entities: EntityRecord[],
): { nodes: Map<string, Omit<VizNode, 'x' | 'y'>>; edges: Map<string, VizEdge> } {
  const entityById = new Map(entities.map((e) => [e.id, e]));
  const nodes = new Map<string, Omit<VizNode, 'x' | 'y'>>();
  const edges = new Map<string, VizEdge>();

  const ensureNode = (id: string, name?: string, type?: string) => {
    if (nodes.has(id)) return;
    const known = entityById.get(id);
    nodes.set(id, {
      id,
      name: name ?? known?.name ?? id.slice(0, 8),
      type: type ?? known?.type ?? 'Concept',
    });
  };

  for (const path of paths) {
    for (let i = 0; i < path.entityIds.length; i++) {
      const id = path.entityIds[i];
      const rel = path.relationships[i];
      if (i === 0) {
        ensureNode(id, path.startEntityName);
      } else if (rel) {
        const isSource = rel.sourceEntityId === id;
        ensureNode(
          id,
          isSource ? rel.sourceEntityName : rel.targetEntityName,
        );
      } else {
        ensureNode(id);
      }
    }

    for (const rel of path.relationships) {
      ensureNode(rel.sourceEntityId, rel.sourceEntityName);
      ensureNode(rel.targetEntityId, rel.targetEntityName);

      const existing = edges.get(rel.id);
      if (existing) {
        if (!existing.pathIds.includes(path.id)) {
          existing.pathIds.push(path.id);
        }
      } else {
        edges.set(rel.id, {
          id: rel.id,
          type: rel.type,
          sourceId: rel.sourceEntityId,
          targetId: rel.targetEntityId,
          evidence: rel.evidence,
          confidence: rel.confidence,
          pathIds: [path.id],
        });
      }
    }
  }

  return { nodes, edges };
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Layer nodes by hop distance; fan neighbors so hub edges do not stack. */
function layoutNodes(
  baseNodes: Map<string, Omit<VizNode, 'x' | 'y'>>,
  edges: Map<string, VizEdge>,
  paths: GraphPath[],
  width: number,
  height: number,
): VizNode[] {
  const starts = new Set(paths.map((p) => p.startEntityId));
  const adj = new Map<string, string[]>();
  for (const e of edges.values()) {
    const a = adj.get(e.sourceId) ?? [];
    a.push(e.targetId);
    adj.set(e.sourceId, a);
    const b = adj.get(e.targetId) ?? [];
    b.push(e.sourceId);
    adj.set(e.targetId, b);
  }

  const layer = new Map<string, number>();
  const queue: string[] = [];
  for (const id of starts) {
    if (baseNodes.has(id)) {
      layer.set(id, 0);
      queue.push(id);
    }
  }
  if (queue.length === 0) {
    for (const id of baseNodes.keys()) {
      layer.set(id, 0);
      queue.push(id);
      break;
    }
  }

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const depth = layer.get(cur) ?? 0;
    for (const n of adj.get(cur) ?? []) {
      if (!layer.has(n) && baseNodes.has(n)) {
        layer.set(n, depth + 1);
        queue.push(n);
      }
    }
  }

  for (const id of baseNodes.keys()) {
    if (!layer.has(id)) layer.set(id, 0);
  }

  const byLayer = new Map<number, string[]>();
  for (const [id, depth] of layer) {
    const list = byLayer.get(depth) ?? [];
    list.push(id);
    byLayer.set(depth, list);
  }

  const maxLayer = Math.max(...byLayer.keys(), 0);
  const usableW = width - PAD_X * 2;
  const usableH = height - PAD_Y * 2;
  const positioned: VizNode[] = [];

  for (const [depth, ids] of byLayer) {
    ids.sort((a, b) =>
      (baseNodes.get(a)?.name ?? '').localeCompare(baseNodes.get(b)?.name ?? ''),
    );

    // Slight x jitter per layer slot so parallel spokes fan out.
    const xBase =
      maxLayer === 0 ? width / 2 : PAD_X + (depth / maxLayer) * usableW;

    ids.forEach((id, i) => {
      const t = ids.length === 1 ? 0.5 : i / (ids.length - 1);
      const y = PAD_Y + t * usableH;
      // Alternate a few px sideways so labels/edges between same hub separate.
      const xNudge =
        depth > 0 && ids.length > 2 ? ((i % 2 === 0 ? -1 : 1) * 18) : 0;
      const base = baseNodes.get(id)!;
      positioned.push({ ...base, x: xBase + xNudge, y });
    });
  }

  return positioned;
}

function edgeGeometry(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  curveIndex: number,
  curveCount: number,
): { d: string; lx: number; ly: number } {
  const dx = tx - sx;
  const dy = ty - sy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;

  const x1 = sx + ux * NODE_R;
  const y1 = sy + uy * NODE_R;
  const x2 = tx - ux * (NODE_R + 8);
  const y2 = ty - uy * (NODE_R + 8);

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const bend =
    curveCount <= 1
      ? Math.min(36, len * 0.12)
      : (curveIndex - (curveCount - 1) / 2) * 34;
  const cx = midX + px * bend;
  const cy = midY + py * bend;

  // Label sits on the curve, nudged further out so stacks do not collide.
  const labelPush = bend === 0 ? 14 : Math.sign(bend || 1) * (Math.abs(bend) + 10);
  const lx = midX + px * labelPush;
  const ly = midY + py * labelPush;

  return {
    d: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`,
    lx,
    ly,
  };
}

function pathContains(
  path: GraphPath | undefined,
  nodeId: string,
  edgeId?: string,
): boolean {
  if (!path) return false;
  if (edgeId) return path.relationships.some((r) => r.id === edgeId);
  return path.entityIds.includes(nodeId);
}

export function PathGraphViz({
  paths,
  entities,
  selectedPathId,
  onSelectPath,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}: Props) {
  const { nodes: baseNodes, edges: edgeMap } = useMemo(
    () => buildGraph(paths, entities),
    [paths, entities],
  );

  const initialLayout = useMemo(
    () => layoutNodes(baseNodes, edgeMap, paths, width, height),
    [baseNodes, edgeMap, paths, width, height],
  );

  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(
    {},
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const next: Record<string, { x: number; y: number }> = {};
    for (const n of initialLayout) {
      next[n.id] = { x: n.x, y: n.y };
    }
    setPositions(next);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, [initialLayout]);

  const selectedPath = paths.find((p) => p.id === selectedPathId);

  const nodes: VizNode[] = initialLayout.map((n) => ({
    ...n,
    x: positions[n.id]?.x ?? n.x,
    y: positions[n.id]?.y ?? n.y,
  }));
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const edges = [...edgeMap.values()];

  const curveMeta = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const edge of edgeMap.values()) {
      const key = pairKey(edge.sourceId, edge.targetId);
      const list = groups.get(key) ?? [];
      list.push(edge.id);
      groups.set(key, list);
    }
    for (const list of groups.values()) {
      list.sort();
    }
    const meta = new Map<string, { index: number; count: number }>();
    for (const list of groups.values()) {
      list.forEach((id, index) => {
        meta.set(id, { index, count: list.length });
      });
    }
    return meta;
  }, [edgeMap]);

  const presentTypes = Object.entries(TYPE_COLORS).filter(([type]) =>
    nodes.some((n) => n.type === type),
  );

  const detailEdge: RelationshipRecord | undefined = (() => {
    if (!selectedEdgeId) return undefined;
    for (const p of paths) {
      const rel = p.relationships.find((r) => r.id === selectedEdgeId);
      if (rel) return rel;
    }
    const e = edgeMap.get(selectedEdgeId);
    if (!e) return undefined;
    return {
      id: e.id,
      type: e.type,
      sourceEntityId: e.sourceId,
      targetEntityId: e.targetId,
      sourceEntityName: nodeById.get(e.sourceId)?.name ?? e.sourceId,
      targetEntityName: nodeById.get(e.targetId)?.name ?? e.targetId,
      documentId: '',
      chunkId: '',
      evidence: e.evidence,
      confidence: e.confidence,
    };
  })();

  function clientToSvg(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const local = pt.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }

  function onNodePointerDown(id: string, e: ReactPointerEvent<SVGGElement>) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const pos = positions[id] ?? { x: 0, y: 0 };
    const local = clientToSvg(e.clientX, e.clientY);
    dragRef.current = { id, ox: local.x - pos.x, oy: local.y - pos.y };
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
  }

  function onPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const local = clientToSvg(e.clientX, e.clientY);
    setPositions((prev) => ({
      ...prev,
      [drag.id]: {
        x: Math.min(width - 28, Math.max(28, local.x - drag.ox)),
        y: Math.min(height - 36, Math.max(28, local.y - drag.oy)),
      },
    }));
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  if (paths.length === 0) {
    return <p className="muted">No traversal paths yet.</p>;
  }

  return (
    <div className="path-viz">
      <div className="path-viz-toolbar">
        <span className="muted path-group-label">
          {nodes.length} nodes · {edges.length} edges
        </span>
        {selectedPathId && (
          <button
            type="button"
            className="btn btn-secondary btn-tiny"
            onClick={() => onSelectPath(null)}
          >
            Clear highlight
          </button>
        )}
      </div>

      <svg
        ref={svgRef}
        className="path-viz-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Interactive graph path visualization"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onClick={() => {
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
        }}
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
          </marker>
          <marker
            id="arrow-active"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
          </marker>
        </defs>

        {edges.map((edge) => {
          const s = nodeById.get(edge.sourceId);
          const t = nodeById.get(edge.targetId);
          if (!s || !t) return null;
          const onPath = pathContains(selectedPath, '', edge.id);
          const dimmed = Boolean(selectedPathId) && !onPath;
          const active = selectedEdgeId === edge.id || onPath;
          const curve = curveMeta.get(edge.id) ?? { index: 0, count: 1 };
          const { d, lx, ly } = edgeGeometry(
            s.x,
            s.y,
            t.x,
            t.y,
            curve.index,
            curve.count,
          );
          return (
            <g
              key={edge.id}
              className={
                dimmed
                  ? 'path-viz-edge dimmed'
                  : active
                    ? 'path-viz-edge active'
                    : 'path-viz-edge'
              }
              onClick={(e) => {
                e.stopPropagation();
                setSelectedEdgeId(edge.id);
                setSelectedNodeId(null);
                if (edge.pathIds[0]) onSelectPath(edge.pathIds[0]);
              }}
            >
              <path
                d={d}
                fill="none"
                strokeWidth={active ? 2.5 : 1.5}
                markerEnd={active ? 'url(#arrow-active)' : 'url(#arrow)'}
              />
              {/* Invisible fat stroke for easier click targeting */}
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={14}
              />
              <text
                x={lx}
                y={ly}
                className="path-viz-edge-label"
                textAnchor="middle"
              >
                {edge.type}
              </text>
            </g>
          );
        })}

        {nodes.map((node) => {
          const onPath = pathContains(selectedPath, node.id);
          const dimmed = Boolean(selectedPathId) && !onPath;
          const selected = selectedNodeId === node.id;
          const hovered = hoverId === node.id;
          const fill = colorForType(node.type);
          return (
            <g
              key={node.id}
              className={
                dimmed
                  ? 'path-viz-node dimmed'
                  : selected || onPath
                    ? 'path-viz-node active'
                    : 'path-viz-node'
              }
              transform={`translate(${node.x}, ${node.y})`}
              onPointerDown={(e) => onNodePointerDown(node.id, e)}
              onMouseEnter={() => setHoverId(node.id)}
              onMouseLeave={() => setHoverId(null)}
              style={{ cursor: 'grab' }}
            >
              <circle
                r={selected || hovered || onPath ? NODE_R + 2 : NODE_R}
                fill={fill}
                stroke={selected || onPath ? '#e2e8f0' : '#0f172a'}
                strokeWidth={selected || onPath ? 2.5 : 1.5}
              />
              <text
                className="path-viz-node-label"
                textAnchor="middle"
                y={NODE_R + 14}
              >
                {node.name.length > 18
                  ? `${node.name.slice(0, 16)}…`
                  : node.name}
              </text>
              <title>
                {node.name} ({node.type})
              </title>
            </g>
          );
        })}
      </svg>

      <div className="path-viz-legend">
        {presentTypes.map(([type, color]) => (
          <span key={type} className="path-viz-legend-item">
            <span className="path-viz-swatch" style={{ background: color }} />
            {type}
          </span>
        ))}
      </div>

      {(selectedNodeId || detailEdge) && (
        <div className="path-viz-detail">
          {selectedNodeId && nodeById.get(selectedNodeId) && (
            <>
              <div className="evidence-id">
                {nodeById.get(selectedNodeId)!.name}
              </div>
              <div className="muted">
                {nodeById.get(selectedNodeId)!.type} · drag to reposition
              </div>
            </>
          )}
          {detailEdge && !selectedNodeId && (
            <>
              <div className="evidence-id">{detailEdge.type}</div>
              <div>
                <strong>{detailEdge.sourceEntityName}</strong>
                {' → '}
                <strong>{detailEdge.targetEntityName}</strong>
              </div>
              {detailEdge.evidence && (
                <p className="muted">&ldquo;{detailEdge.evidence}&rdquo;</p>
              )}
              {detailEdge.confidence != null && (
                <div className="muted">
                  confidence {detailEdge.confidence.toFixed(2)}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <p className="muted path-viz-hint">
        Click a path below to highlight it. Drag nodes; click an edge for
        evidence.
      </p>
    </div>
  );
}
