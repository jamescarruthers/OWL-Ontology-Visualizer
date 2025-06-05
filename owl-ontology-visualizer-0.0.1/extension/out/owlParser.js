"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OWLParser = void 0;
const n3_1 = require("n3");
class OWLParser {
    store;
    prefixes;
    constructor() {
        this.store = new n3_1.Store();
        this.prefixes = new Map();
        // Common OWL/RDF prefixes
        this.prefixes.set('rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#');
        this.prefixes.set('rdfs', 'http://www.w3.org/2000/01/rdf-schema#');
        this.prefixes.set('owl', 'http://www.w3.org/2002/07/owl#');
        this.prefixes.set('xsd', 'http://www.w3.org/2001/XMLSchema#');
    }
    async parse(owlContent) {
        try {
            console.log('OWL Parser: Starting to parse content of length:', owlContent.length);
            console.log('OWL Parser: First 200 characters:', owlContent.substring(0, 200));
            // For now, we'll focus on Turtle format since N3 handles it well
            // If the content looks like RDF/XML, we'll give a helpful error
            if (owlContent.trim().startsWith('<?xml') || owlContent.includes('<rdf:RDF')) {
                throw new Error('RDF/XML format detected. Please convert your OWL file to Turtle format (.ttl) for better compatibility. You can use online converters or tools like Protégé to export as Turtle.');
            }
            // Parse using N3 (supports Turtle, N-Triples, N-Quads)
            const parser = new n3_1.Parser();
            console.log('OWL Parser: Created N3 parser, attempting to parse...');
            const quads = parser.parse(owlContent);
            console.log('OWL Parser: Parsed', quads.length, 'quads');
            // Clear store and add new quads
            this.store = new n3_1.Store();
            this.store.addQuads(quads);
            console.log('OWL Parser: Added quads to store, total quads in store:', this.store.size);
            const result = this.extractOntologyData();
            console.log('OWL Parser: Extraction complete. Found', result.nodes.length, 'nodes and', result.edges.length, 'edges');
            return result;
        }
        catch (error) {
            console.error('Error parsing OWL:', error);
            throw new Error(`Failed to parse OWL file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    extractOntologyData() {
        console.log('OWL Parser: Starting extraction from store with', this.store.size, 'quads');
        const nodes = new Map();
        const edges = [];
        const metadata = {};
        // Debug: Log first few quads to see what we have
        const allQuads = this.store.getQuads(null, null, null, null);
        console.log('OWL Parser: Sample quads:');
        allQuads.slice(0, 5).forEach((quad, i) => {
            console.log(`  ${i}: ${quad.subject.value} ${quad.predicate.value} ${quad.object.value}`);
        });
        // Extract ontology metadata
        const ontologyQuads = this.store.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/2002/07/owl#Ontology', null);
        console.log('OWL Parser: Found', ontologyQuads.length, 'ontology declarations');
        if (ontologyQuads.length > 0) {
            const ontologyURI = ontologyQuads[0].subject.value;
            metadata.ontologyURI = ontologyURI;
            // Try to get title and description
            const titleQuads = this.store.getQuads(ontologyQuads[0].subject, 'http://purl.org/dc/elements/1.1/title', null, null);
            if (titleQuads.length > 0) {
                metadata.title = titleQuads[0].object.value;
            }
            const descQuads = this.store.getQuads(ontologyQuads[0].subject, 'http://purl.org/dc/elements/1.1/description', null, null);
            if (descQuads.length > 0) {
                metadata.description = descQuads[0].object.value;
            }
        }
        // Extract classes - try multiple approaches
        let classQuads = this.store.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/2002/07/owl#Class', null);
        console.log('OWL Parser: Found', classQuads.length, 'owl:Class declarations');
        // Also look for rdfs:Class
        const rdfsClassQuads = this.store.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/2000/01/rdf-schema#Class', null);
        console.log('OWL Parser: Found', rdfsClassQuads.length, 'rdfs:Class declarations');
        // Combine both types of class declarations
        classQuads = [...classQuads, ...rdfsClassQuads];
        // Also infer classes from subClassOf relationships
        const subClassQuads = this.store.getQuads(null, 'http://www.w3.org/2000/01/rdf-schema#subClassOf', null, null);
        console.log('OWL Parser: Found', subClassQuads.length, 'subClassOf relationships');
        // Add subjects and objects of subClassOf as classes
        subClassQuads.forEach(quad => {
            if (quad.subject.termType === 'NamedNode') {
                const uri = quad.subject.value;
                const id = this.getLocalName(uri);
                if (!nodes.has(id)) {
                    nodes.set(id, {
                        id,
                        label: this.getLabel(quad.subject) || id,
                        type: 'class',
                        uri
                    });
                }
            }
            if (quad.object.termType === 'NamedNode') {
                const uri = quad.object.value;
                const id = this.getLocalName(uri);
                if (!nodes.has(id)) {
                    nodes.set(id, {
                        id,
                        label: this.getLabel(quad.object) || id,
                        type: 'class',
                        uri
                    });
                }
            }
        });
        classQuads.forEach(quad => {
            // Skip blank nodes for classes as they're typically not meaningful for visualization
            if (quad.subject.termType !== 'NamedNode') {
                return;
            }
            const uri = quad.subject.value;
            const id = this.getLocalName(uri);
            if (!nodes.has(id)) {
                nodes.set(id, {
                    id,
                    label: this.getLabel(quad.subject) || id,
                    type: 'class',
                    uri
                });
            }
        });
        console.log('OWL Parser: After class extraction, found', Array.from(nodes.values()).filter(n => n.type === 'class').length, 'classes');
        // Extract properties
        const propertyTypes = [
            'http://www.w3.org/2002/07/owl#ObjectProperty',
            'http://www.w3.org/2002/07/owl#DatatypeProperty',
            'http://www.w3.org/2002/07/owl#AnnotationProperty',
            'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property'
        ];
        propertyTypes.forEach(propertyType => {
            const propQuads = this.store.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', propertyType, null);
            console.log('OWL Parser: Found', propQuads.length, 'properties of type', propertyType);
            propQuads.forEach(quad => {
                // Skip blank nodes for properties
                if (quad.subject.termType !== 'NamedNode') {
                    return;
                }
                const uri = quad.subject.value;
                const id = this.getLocalName(uri);
                if (!nodes.has(id)) {
                    nodes.set(id, {
                        id,
                        label: this.getLabel(quad.subject) || id,
                        type: 'property',
                        uri
                    });
                }
            });
        });
        // Also infer properties from domain/range declarations
        const domainQuads = this.store.getQuads(null, 'http://www.w3.org/2000/01/rdf-schema#domain', null, null);
        const rangeQuads = this.store.getQuads(null, 'http://www.w3.org/2000/01/rdf-schema#range', null, null);
        console.log('OWL Parser: Found', domainQuads.length, 'domain declarations and', rangeQuads.length, 'range declarations');
        [...domainQuads, ...rangeQuads].forEach(quad => {
            if (quad.subject.termType === 'NamedNode') {
                const uri = quad.subject.value;
                const id = this.getLocalName(uri);
                if (!nodes.has(id)) {
                    nodes.set(id, {
                        id,
                        label: this.getLabel(quad.subject) || id,
                        type: 'property',
                        uri
                    });
                }
            }
        });
        console.log('OWL Parser: After property extraction, found', Array.from(nodes.values()).filter(n => n.type === 'property').length, 'properties');
        // Extract individuals
        const individualQuads = this.store.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/2002/07/owl#NamedIndividual', null);
        console.log('OWL Parser: Found', individualQuads.length, 'named individuals');
        individualQuads.forEach(quad => {
            // Skip blank nodes for individuals
            if (quad.subject.termType !== 'NamedNode') {
                return;
            }
            const uri = quad.subject.value;
            const id = this.getLocalName(uri);
            if (!nodes.has(id)) {
                nodes.set(id, {
                    id,
                    label: this.getLabel(quad.subject) || id,
                    type: 'individual',
                    uri
                });
            }
        });
        console.log('OWL Parser: After individual extraction, found', Array.from(nodes.values()).filter(n => n.type === 'individual').length, 'individuals');
        // Extract relationships
        let edgeCounter = 0;
        // SubClass relationships
        subClassQuads.forEach(quad => {
            if (quad.subject.termType !== 'NamedNode' || quad.object.termType !== 'NamedNode') {
                return;
            }
            const sourceId = this.getLocalName(quad.subject.value);
            const targetId = this.getLocalName(quad.object.value);
            // Ensure both nodes exist
            this.ensureNode(nodes, sourceId, quad.subject.value, 'class');
            this.ensureNode(nodes, targetId, quad.object.value, 'class');
            edges.push({
                id: `edge_${edgeCounter++}`,
                source: sourceId,
                target: targetId,
                label: 'subClassOf',
                type: 'subClassOf'
            });
        });
        // SubProperty relationships
        const subPropertyQuads = this.store.getQuads(null, 'http://www.w3.org/2000/01/rdf-schema#subPropertyOf', null, null);
        subPropertyQuads.forEach(quad => {
            if (quad.subject.termType !== 'NamedNode' || quad.object.termType !== 'NamedNode') {
                return;
            }
            const sourceId = this.getLocalName(quad.subject.value);
            const targetId = this.getLocalName(quad.object.value);
            this.ensureNode(nodes, sourceId, quad.subject.value, 'property');
            this.ensureNode(nodes, targetId, quad.object.value, 'property');
            edges.push({
                id: `edge_${edgeCounter++}`,
                source: sourceId,
                target: targetId,
                label: 'subPropertyOf',
                type: 'subPropertyOf'
            });
        });
        // Domain and Range relationships
        domainQuads.forEach(quad => {
            if (quad.subject.termType !== 'NamedNode' || quad.object.termType !== 'NamedNode') {
                return;
            }
            const sourceId = this.getLocalName(quad.subject.value);
            const targetId = this.getLocalName(quad.object.value);
            this.ensureNode(nodes, sourceId, quad.subject.value, 'property');
            this.ensureNode(nodes, targetId, quad.object.value, 'class');
            edges.push({
                id: `edge_${edgeCounter++}`,
                source: sourceId,
                target: targetId,
                label: 'domain',
                type: 'domain'
            });
        });
        rangeQuads.forEach(quad => {
            if (quad.subject.termType !== 'NamedNode' || quad.object.termType !== 'NamedNode') {
                return;
            }
            const sourceId = this.getLocalName(quad.subject.value);
            const targetId = this.getLocalName(quad.object.value);
            this.ensureNode(nodes, sourceId, quad.subject.value, 'property');
            this.ensureNode(nodes, targetId, quad.object.value, 'class');
            edges.push({
                id: `edge_${edgeCounter++}`,
                source: sourceId,
                target: targetId,
                label: 'range',
                type: 'range'
            });
        });
        console.log('OWL Parser: Final result - nodes:', nodes.size, 'edges:', edges.length);
        console.log('OWL Parser: Node breakdown:', {
            classes: Array.from(nodes.values()).filter(n => n.type === 'class').length,
            properties: Array.from(nodes.values()).filter(n => n.type === 'property').length,
            individuals: Array.from(nodes.values()).filter(n => n.type === 'individual').length
        });
        return {
            nodes: Array.from(nodes.values()),
            edges,
            metadata
        };
    }
    ensureNode(nodes, id, uri, type) {
        if (!nodes.has(id)) {
            nodes.set(id, {
                id,
                label: this.getLocalName(uri),
                type,
                uri
            });
        }
    }
    getLocalName(uri) {
        // Handle blank nodes
        if (uri.startsWith('_:')) {
            return uri; // Return the blank node identifier as-is
        }
        const hashIndex = uri.lastIndexOf('#');
        const slashIndex = uri.lastIndexOf('/');
        const lastIndex = Math.max(hashIndex, slashIndex);
        if (lastIndex >= 0 && lastIndex < uri.length - 1) {
            return uri.substring(lastIndex + 1);
        }
        return uri;
    }
    getLabel(subject) {
        // Only try to get labels for NamedNodes, not BlankNodes
        if (subject.termType !== 'NamedNode') {
            return null;
        }
        const labelQuads = this.store.getQuads(subject, 'http://www.w3.org/2000/01/rdf-schema#label', null, null);
        if (labelQuads.length > 0) {
            return labelQuads[0].object.value;
        }
        return null;
    }
}
exports.OWLParser = OWLParser;
//# sourceMappingURL=owlParser.js.map