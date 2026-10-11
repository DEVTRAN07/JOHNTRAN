'use strict';

var errors = require('../core/errors.cjs');
var factory = require('../core/factory.cjs');
require('../models/AutoReply.cjs');
require('../models/Bank.cjs');
require('../models/Board.cjs');
var Enum = require('../models/Enum.cjs');
require('../models/FriendEvent.cjs');
require('../models/Group.cjs');
require('../models/GroupEvent.cjs');
require('../models/Reaction.cjs');
require('../models/Reminder.cjs');
require('../models/ZBusiness.cjs');

const findUserByUsernameFactory = factory.apiFactory()((api, _ctx, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.friend[0]}/api/friend/search/by-user-name`);
    /**
     * Find user by username
     *
     * @param username username for find
     * @param avatarSize Avatar size (default: AvatarSize.Large)
     *
     * @throws {ZaloApiError}
     */
    return async function findUserByUsername(username, avatarSize = Enum.AvatarSize.Large) {
        const params = {
            user_name: username,
            avatar_size: avatarSize,
        };
        const encryptedParams = utils.encodeAES(JSON.stringify(params));
        if (!encryptedParams)
            throw new errors.ZaloApiError("Failed to encrypt params");
        const response = await utils.request(utils.makeURL(serviceURL, { params: encryptedParams }), {
            method: "GET",
        });
        return utils.resolve(response);
    };
});

exports.findUserByUsernameFactory = findUserByUsernameFactory;
