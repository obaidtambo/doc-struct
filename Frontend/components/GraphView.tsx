import React, { useMemo, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { AnalyzedParagraph } from '../types';
import { Plus, Minus, Maximize } from './Icons';

interface GraphViewProps {
  paragraphs: AnalyzedParagraph[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onHoverRow: (id: string | null) => void;
  setSvgElement: (element: SVGSVGElement | null) => void;
}

interface TreeNode extends AnalyzedParagraph {
  children: TreeNode[];
  x: number;
  y: number;
  width: number;
  height: number;
}

const NODE_WIDTH = 200;
const NODE_HEIGHT = 60;
const HORIZONTAL_SPACING = 50;
const VERTICAL_SPACING = 40;

const buildTree = (paragraphs: AnalyzedParagraph[]): TreeNode | null => {
  if (paragraphs.length === 0) return null;

  const nodesById = new Map<string, TreeNode>();
  paragraphs.forEach(p => {
    nodesById.set(p.id, { ...p, children: [], x: 0, y: 0, width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  let root: TreeNode | null = null;
  paragraphs.forEach(p => {
    if (p.parentId && nodesById.has(p.parentId)) {
      // Ensure a node is not its own parent which can happen with bad data
      if (p.id !== p.parentId) {
        nodesById.get(p.parentId)?.children.push(nodesById.get(p.id)!);
      }
    } else {
      root = nodesById.get(p.id)!;
    }
  });
  return root;
};

// Simple layout algorithm
const layoutTree = (node: TreeNode, x = 0, y = 0): { yMax: number, xMax: number } => {
  node.x = x;
  node.y = y;
  
  let currentY = y;
  let maxX = x + NODE_WIDTH;

  if (node.children.length > 0) {
      node.children.forEach((child, index) => {
          const childY = index === 0 ? currentY : currentY + VERTICAL_SPACING;
          const { yMax, xMax } = layoutTree(child, x + NODE_WIDTH + HORIZONTAL_SPACING, childY);
          currentY = yMax;
          maxX = Math.max(maxX, xMax);
      });
  }
  
  return { yMax: currentY + NODE_HEIGHT, xMax: maxX };
};


const GraphView: React.FC<GraphViewProps> = ({ paragraphs, selectedIds, onSelectionChange, onHoverRow, setSvgElement }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null); // Ref for the zoomable group
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  
  const { rootNode, allNodes, allLinks, bounds } = useMemo(() => {
    const root = buildTree(paragraphs);
    const nodes: TreeNode[] = [];
    const links: { source: TreeNode, target: TreeNode }[] = [];
    let layoutBounds = { yMax: 0, xMax: 0 };

    if (root) {
      layoutBounds = layoutTree(root);
      const traverse = (node: TreeNode | null) => {
        if (!node) return;
        nodes.push(node);
        node.children.forEach(child => {
          links.push({ source: node, target: child });
          traverse(child);
        });
      };
      traverse(root);
    }
    return { rootNode: root, allNodes: nodes, allLinks: links, bounds: layoutBounds };
  }, [paragraphs]);

  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;
    
    setSvgElement(svgRef.current);
    
    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);

    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4]) // Set zoom range
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
        });

    svg.call(zoomBehavior);
    zoomRef.current = zoomBehavior;

    // Center and fit the graph on initial render or data change
    if (svgRef.current && paragraphs.length > 0) {
        const { width, height } = svgRef.current.getBoundingClientRect();
        if (bounds.xMax > 0 && bounds.yMax > 0) {
            const scaleX = width / bounds.xMax;
            const scaleY = height / bounds.yMax;
            const scale = Math.min(scaleX, scaleY, 1) * 0.95; // 5% padding
            
            const translateX = (width - bounds.xMax * scale) / 2;
            const translateY = (height - bounds.yMax * scale) / 2;
            
            const initialTransform = d3.zoomIdentity.translate(translateX, translateY).scale(scale);
            
            // Apply initial transform immediately for a better loading experience
            svg.call(zoomBehavior.transform, initialTransform);
        }
    }

    return () => {
        svg.on('.zoom', null); // Cleanup zoom behavior on unmount
    };
  }, [paragraphs, bounds, setSvgElement]);
  
  const handleNodeClick = (id: string) => {
      const newSelection = new Set(selectedIds);
      if(newSelection.has(id)) {
          newSelection.delete(id);
      } else {
          newSelection.add(id);
      }
      onSelectionChange(newSelection);
  }
  
  const handleZoomIn = () => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, 1.3);
  };
  
  const handleZoomOut = () => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, 1 / 1.3);
  };
  
  const handleResetView = () => {
    if (!svgRef.current || !zoomRef.current) return;
    
    const svg = d3.select(svgRef.current);
    const { width, height } = svgRef.current.getBoundingClientRect();
    if (bounds.xMax > 0 && bounds.yMax > 0) {
        const scaleX = width / bounds.xMax;
        const scaleY = height / bounds.yMax;
        const scale = Math.min(scaleX, scaleY, 1) * 0.95;
        
        const translateX = (width - bounds.xMax * scale) / 2;
        const translateY = (height - bounds.yMax * scale) / 2;
        
        const transform = d3.zoomIdentity.translate(translateX, translateY).scale(scale);
        
        svg.transition().duration(750).call(zoomRef.current.transform, transform);
    }
  };


  if (!rootNode) {
    return <div className="p-4 text-content-secondary">No data to display in graph view.</div>;
  }

  return (
    <div className="w-full h-full bg-base-200 overflow-hidden relative">
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
            <button onClick={handleZoomIn} className="p-2 bg-base-100 rounded-md shadow-md hover:bg-base-300 transition-colors border border-base-300" title="Zoom In" aria-label="Zoom In">
                <Plus className="w-5 h-5 text-content-primary" />
            </button>
            <button onClick={handleZoomOut} className="p-2 bg-base-100 rounded-md shadow-md hover:bg-base-300 transition-colors border border-base-300" title="Zoom Out" aria-label="Zoom Out">
                <Minus className="w-5 h-5 text-content-primary" />
            </button>
            <button onClick={handleResetView} className="p-2 bg-base-100 rounded-md shadow-md hover:bg-base-300 transition-colors border border-base-300" title="Fit to View" aria-label="Fit to View">
                <Maximize className="w-5 h-5 text-content-primary" />
            </button>
        </div>
        <svg
            ref={svgRef}
            width="100%"
            height="100%"
            className="cursor-grab"
        >
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#4B5563" />
            </marker>
          </defs>
            <g ref={gRef}>
                {/* Links */}
                {allLinks.map(({ source, target }) => (
                    <line
                        key={`${source.id}-${target.id}`}
                        x1={source.x + NODE_WIDTH / 2}
                        y1={source.y + NODE_HEIGHT}
                        x2={target.x + NODE_WIDTH / 2}
                        y2={target.y}
                        stroke="#4B5563"
                        strokeWidth="1.5"
                    />
                ))}
                
                {/* Nodes */}
                {allNodes.map(node => (
                    <g
                        key={node.id}
                        transform={`translate(${node.x}, ${node.y})`}
                        className="cursor-pointer"
                        onClick={() => handleNodeClick(node.id)}
                        onMouseEnter={() => onHoverRow(node.id)}
                        onMouseLeave={() => onHoverRow(null)}
                    >
                        <rect
                            width={NODE_WIDTH}
                            height={NODE_HEIGHT}
                            rx="8"
                            fill={selectedIds.has(node.id) ? '#3730A3' : '#1F2937'}
                            stroke={selectedIds.has(node.id) ? '#A5B4FC' : '#4B5563'}
                            strokeWidth="2"
                        />
                        <foreignObject width={NODE_WIDTH - 16} height={NODE_HEIGHT - 16} x="8" y="8">
                            <div className="text-content-primary text-xs h-full flex flex-col justify-center overflow-hidden p-1">
                                <p className="font-bold truncate" title={node.role || ''}>{node.role || 'paragraph'}</p>
                                <p className="text-content-secondary truncate" title={node.content}>{node.content}</p>
                            </div>
                        </foreignObject>
                    </g>
                ))}
            </g>
        </svg>
    </div>
  );
};

export default GraphView;