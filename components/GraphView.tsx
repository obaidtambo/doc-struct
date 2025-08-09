import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { AnalyzedParagraph } from '../types';

interface GraphViewProps {
  paragraphs: AnalyzedParagraph[];
  onGraphReady: (svgElement: SVGSVGElement) => void;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  content: string;
  role: string | null;
  level: number;
  x?: number;
  y?: number;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {}

const GraphView: React.FC<GraphViewProps> = ({ paragraphs, onGraphReady }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!paragraphs || paragraphs.length === 0 || !svgRef.current || !containerRef.current) return;
    
    const container = containerRef.current;
    const svgElement = svgRef.current;

    const dataWithRoot: AnalyzedParagraph[] = [
      { id: 'root', parentId: null, content: 'DOCUMENT', role: 'root', level: 0, boundingBox: null, pageNumber: null, enrichment: {} },
      ...paragraphs.map(p => ({ ...p, parentId: !p.parentId || p.parentId === '' ? 'root' : p.parentId }))
    ];

    const nodes: GraphNode[] = dataWithRoot.map(p => ({
      id: p.id,
      content: p.content,
      role: p.role,
      level: p.level,
    }));
    
    const linksWithIds = dataWithRoot
      .filter(p => p.parentId)
      .map(p => ({ source: p.id, target: p.parentId! }));

    // This cast is necessary because we initialize with string IDs, but D3's types
    // expect full node objects. D3 handles this conversion internally.
    const links: GraphLink[] = linksWithIds as any;

    const width = container.clientWidth;
    const height = Math.max(700, paragraphs.length * 35);

    const svg = d3.select(svgElement)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height])
      .style('background-color', 'transparent');

    svg.selectAll('*').remove();
    const g = svg.append('g');

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(d => ((d.target as GraphNode).level === 0 ? 80 : 120)).strength(0.7))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05));

    const link = g.append('g')
      .attr('stroke', '#4b5563') // gray-600
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', 1.5);

    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g');

    const nodeRadius = (d: GraphNode) => d.role === 'root' || d.role === 'title' ? 10 : (d.role === 'sectionHeading' ? 8 : 6);
    
    node.append('circle')
      .attr('r', nodeRadius)
      .attr('fill', d => {
        if (d.role === 'title' || d.role === 'root') return '#4f46e5'; // indigo-600
        if (d.role === 'sectionHeading') return '#2563eb'; // blue-600
        return '#16a34a'; // green-600
      })
      .attr('stroke', '#e5e7eb') // gray-200
      .attr('stroke-width', 1.5);

    node.append('text')
      .text(d => d.content.length > 30 ? d.content.substring(0, 30) + '...' : d.content)
      .attr('x', d => nodeRadius(d) + 5)
      .attr('y', 4)
      .style('font-size', '10px')
      .attr('fill', '#d1d5db') // gray-300
      .attr('paint-order', 'stroke')
      .attr('stroke', '#111827') // gray-900 (base-200)
      .attr('stroke-width', 3)
      .attr('stroke-linecap', 'butt')
      .attr('stroke-linejoin', 'miter');

    node.append('title')
      .text(d => `Role: ${d.role}\nLevel: ${d.level}\n\n${d.content}`);

    const drag = d3.drag<SVGGElement, GraphNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    node.call(drag);

    // Highlighting on hover
    node.on('mouseover', (event, d) => {
        const isNeighbor = (n: GraphNode) => linksWithIds.some(l => (l.source === d.id && l.target === n.id) || (l.target === d.id && l.source === n.id));
        
        node.style('opacity', n => (n.id === d.id || isNeighbor(n)) ? 1 : 0.2);
        link.style('opacity', l => ((l.source as GraphNode).id === d.id || (l.target as GraphNode).id === d.id) ? 1 : 0.2);
        link.attr('stroke', l => ((l.source as GraphNode).id === d.id || (l.target as GraphNode).id === d.id) ? '#93c5fd' : '#4b5563'); // blue-300
    }).on('mouseout', () => {
        node.style('opacity', 1);
        link.style('opacity', 0.6);
        link.attr('stroke', '#4b5563');
    });

    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as GraphNode).x!)
        .attr('y1', d => (d.source as GraphNode).y!)
        .attr('x2', d => (d.target as GraphNode).x!)
        .attr('y2', d => (d.target as GraphNode).y!);
      node
        .attr('transform', d => `translate(${d.x!},${d.y!})`);
    });
    
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
        });
    
    svg.call(zoomBehavior);

    if(svgElement) {
        onGraphReady(svgElement);
    }

  }, [paragraphs, onGraphReady]);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[700px] overflow-hidden rounded-b-lg bg-base-200">
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default GraphView;