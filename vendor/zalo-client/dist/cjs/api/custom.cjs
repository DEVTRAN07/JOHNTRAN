'use strict';

var factory = require('../core/factory.cjs');

/* eslint-disable */
const customFactory = factory.apiFactory()((api, ctx, utils) => {
    return function custom(name, callback) {
        Object.defineProperty(api, name, {
            value: function (props) {
                return callback({ ctx, utils, props });
            },
            writable: false,
            enumerable: false,
            configurable: false,
        });
    };
});

exports.customFactory = customFactory;
