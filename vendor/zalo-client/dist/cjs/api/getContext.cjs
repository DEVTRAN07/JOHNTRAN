'use strict';

var factory = require('../core/factory.cjs');

const getContextFactory = factory.apiFactory()((_, ctx) => {
    return () => ctx;
});

exports.getContextFactory = getContextFactory;
