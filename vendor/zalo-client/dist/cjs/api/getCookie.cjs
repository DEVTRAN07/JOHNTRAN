'use strict';

var factory = require('../core/factory.cjs');

const getCookieFactory = factory.apiFactory()((_, ctx) => {
    /**
     * Get the current cookie string
     */
    return function getCookie() {
        return ctx.cookie;
    };
});

exports.getCookieFactory = getCookieFactory;
