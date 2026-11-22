'use strict';
// Náhrada Node https pro lib/skt.js: spojení drží Nuvio samo, Agent je jen prázdná třída.
class Agent { constructor(opts) { this.options = opts || {}; } addRequest() {} }
module.exports = { Agent };
