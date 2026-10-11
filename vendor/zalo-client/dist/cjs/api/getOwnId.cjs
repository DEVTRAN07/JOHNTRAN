'use strict';

var factory = require('../core/factory.cjs');

const getOwnIdFactory = factory.apiFactory()((_, ctx) => {
    return () => ctx.uid;
});

exports.getOwnIdFactory = getOwnIdFactory;
