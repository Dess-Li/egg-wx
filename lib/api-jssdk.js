'use strict';
const crypto = require('crypto');
const utils = require('./utils');
const moment = require('moment');

module.exports = app => {
  /**
   * jssdk接口
   */
  class ApiJssdk {
    /**
     * 返回Redis对象
     * @return {object} redis对象
     */
    getRedisCache() {
      if (app.config.wx.redisClient === '') {
        return app.redis;
      }
      return app.redis.get(app.config.wx.redisClient);
    }

    async getJsapiTicket() {
      const accessToken = await app.wx.apiCommon.getAccessToken();
      const redis = this.getRedisCache();
      const cacheData = await redis.get(app.config.wx.redisPrefix + '-jsapiTicket');
      if (cacheData === null) {
        return await this.getJsapiTicketFromApi(accessToken);
      }
      return cacheData;
    }

    async getJsapiTicketFromApi(accessToken) {
      const redis = this.getRedisCache();
      const res = await app.curl(
        app.config.wx.apiBaseUrl + app.config.wx.apiUrl.getJsapiTicket,
        {
          dataType: 'json',
          data: {
            access_token: accessToken,
            type: 'jsapi',
          },
        }
      );
      utils.checkResponseStatus(res);
      await redis.set(app.config.wx.redisPrefix + '-jsapiTicket', JSON.stringify(res.data.ticket), 'EX', res.data.expires_in);
      return res.data.ticket;
    }

    async getSign(url, nonce, timestamp) {
      const jsapiTicket = await this.getJsapiTicket();
      const urlParams = `jsapi_ticket=${jsapiTicket}&noncestr=${nonce}&timestamp=${timestamp}&url=${url}`;
      const sha1 = crypto.createHash('sha1');
      sha1.update(urlParams);
      return sha1.digest('hex');
    }

    async getJsapiConfig(url) {
      const nonce = utils.getRandomStr();
      const timestamp = moment().utc().format('x');
      const signature = await this.getSign(url, nonce, timestamp);
      return {
        appId: app.config.wx.AppID,
        timestamp,
        nonceStr: nonce,
        signature,
      };
    }
  }
  return new ApiJssdk();
};