/**
 * Proton Clinical Reasoning & Evidence Grounding Engine
 * Phase 2: Evidence Graph
 *
 * Tracks directional relationships:
 * PATIENT → FACT
 * FACT → SUPPORTS → HYPOTHESIS
 * FACT → CONTRADICTS → HYPOTHESIS
 * HYPOTHESIS → REQUIRES → TEST
 * CLAIM / FACT → SUPPORTED_BY → EXTERNAL_SOURCE
 */

class EvidenceGraph {
  constructor(patientId) {
    this.patientId = patientId;
    this.nodes = new Map(); // id -> { id, type, data }
    this.edges = [];        // { from, to, relation, metadata }
  }

  addNode(id, type, data = {}) {
    if (!this.nodes.has(id)) {
      this.nodes.set(id, { id, type, data });
    }
    return this.nodes.get(id);
  }

  addEdge(fromId, toId, relation, metadata = {}) {
    // Validate nodes exist or create placeholders
    if (!this.nodes.has(fromId)) this.addNode(fromId, 'UNKNOWN_NODE');
    if (!this.nodes.has(toId)) this.addNode(toId, 'UNKNOWN_NODE');

    // Avoid duplicate edges
    const exists = this.edges.some(e => e.from === fromId && e.to === toId && e.relation === relation);
    if (!exists) {
      this.edges.push({ from: fromId, to: toId, relation, metadata });
    }
  }

  getSupportingFacts(hypothesisId) {
    return this.edges
      .filter(e => e.to === hypothesisId && e.relation === 'SUPPORTS')
      .map(e => this.nodes.get(e.from)?.data || e.from);
  }

  getContradictingFacts(hypothesisId) {
    return this.edges
      .filter(e => e.to === hypothesisId && e.relation === 'CONTRADICTS')
      .map(e => this.nodes.get(e.from)?.data || e.from);
  }

  getRequiredTests(hypothesisId) {
    return this.edges
      .filter(e => e.from === hypothesisId && e.relation === 'REQUIRES')
      .map(e => this.nodes.get(e.to)?.data || e.to);
  }

  getExternalSources(nodeId) {
    return this.edges
      .filter(e => e.from === nodeId && e.relation === 'SUPPORTED_BY')
      .map(e => this.nodes.get(e.to)?.data || e.to);
  }

  getProvenanceChain(targetId) {
    const chain = { targetId, upstream: [], downstream: [] };
    
    // Upstream (who points to this node)
    this.edges.filter(e => e.to === targetId).forEach(e => {
      chain.upstream.push({
        sourceId: e.from,
        relation: e.relation,
        nodeType: this.nodes.get(e.from)?.type
      });
    });

    // Downstream (what this node points to)
    this.edges.filter(e => e.from === targetId).forEach(e => {
      chain.downstream.push({
        targetId: e.to,
        relation: e.relation,
        nodeType: this.nodes.get(e.to)?.type
      });
    });

    return chain;
  }

  toJSON() {
    return {
      patientId: this.patientId,
      nodesCount: this.nodes.size,
      edgesCount: this.edges.length,
      nodes: Array.from(this.nodes.values()),
      edges: this.edges
    };
  }
}

module.exports = {
  EvidenceGraph
};
