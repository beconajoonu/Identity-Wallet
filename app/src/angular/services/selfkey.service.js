'use strict';

const Ico = requireAppModule('angular/classes/ico');
const EthUtils = requireAppModule('angular/classes/eth-utils');
const IdAttributeType = requireAppModule('angular/classes/id-attribute-type');

function SelfkeyService($rootScope, $window, $q, $timeout, $log, $http, ConfigFileService) {
  'ngInject';

  $log.info('SelfkeyService Initialized');

  /**
   * temporary (need restructure.. take it from config);
   */
  let BASE_URL = null;
  let KYC_BASE_URL = null;
  if ($rootScope.isDevMode) {
    BASE_URL = 'https://alpha.selfkey.org/marketplace/i/api/';
    KYC_BASE_URL = 'https://token-sale-demo-api.kyc-chain.com/';
  } else {
    BASE_URL = 'https://alpha.selfkey.org/marketplace/i/api/';
    KYC_BASE_URL = 'https://tokensale-api.selfkey.org/';
  }

  /**
   * 
   */
  let CACHE = window.sessionStorage;

  /**
   * 
   */
  const PRICES = {};

  /**
   * 
   */
  class SelfkeyService {

    constructor() {
      this.loadData(true);
    }

    retrieveTableData(table, reload) {
      let defer = $q.defer();

      // temporary (reload anyway)
      reload = true;

      const cache_data = CACHE.getItem(table);
      if (reload || !cache_data) {
        const apiURL = BASE_URL + table;
        let promise = $http.get(apiURL, { headers: { 'Cache-Control': 'no-cache' } });
        promise.then((response) => {
          CACHE.setItem(table, JSON.stringify(response.data));
          defer.resolve(response.data);
        }).catch((error) => {
          // TODO
          defer.reject(error);
        });
      } else {
        defer.resolve(JSON.parse(cache_data));
      }

      return defer.promise;
    }

    dispatchIdAttributeTypes(reload) {
      let defer = $q.defer();

      let idAttributeTypes = {};
      let promise = this.retrieveTableData('id-attributes', reload);
      promise.then((data) => {
        let idAttributesArray = data.ID_Attributes;

        for (let i in idAttributesArray) {
          if (!idAttributesArray[i].data) continue;
          let item = idAttributesArray[i].data.fields;
          idAttributeTypes[item.key] = new IdAttributeType(
            item.key,
            item.category,
            item.type,
            item.entity
          );
        }

        defer.resolve(idAttributeTypes);
      });

      return defer.promise;
    }

    dispatchIcos(reload) {
      let defer = $q.defer();

      let icos = [];
      let promise = this.retrieveTableData('icos', reload);
      promise.then((data) => {
        let icoDetailsArray = data.ICO_Details;

        for (let i in icoDetailsArray) {
          if (!icoDetailsArray[i].data) continue;
          let item = icoDetailsArray[i].data.fields;
          if (!item.symbol) continue;

          let ico = new Ico(
            item.symbol,
            item.status,
            item.company,
            item.category
          );

          ico.setDate(item.start_date, item.end_date);

          ico.setTokenInfo(
            item.token_price,
            item.total_token_supply,
            item.presale_sold_usd,
            item.tokens_available_for_sale,
            item.token_issuance
          );

          ico.setCap(item.hard_cap_USD, item.raised_USD);
          ico.setRestrictions(item.min_contribution_usd, item.max_contribution_usd, item.restrictions);
          ico.setKyc(item.kyc_api_endpoint, item.kyc, item.template, item.organisation);
          ico.setVideos(item.youtube_video, null);

          ico.setInfo(
            item.description,
            item.short_description,
            item.ethaddress,
            item.whitepaper,
            item.website,
            item.whitelist,
            item.accepts
          );

          icos.push(ico);
        }

        defer.resolve(icos);
      });

      return defer.promise;
    }

    retrieveKycTemplate(kycBaseUrl, organizationId, templateId) {
      let defer = $q.defer();

      let promise = $http.get(kycBaseUrl + "/organization/" + organizationId + "/template/marketplace/" + templateId);
      promise.then((resp) => {
        defer.resolve(resp.data);
      }).catch((error) => {
        defer.reject(error);
      });

      return defer.promise;
    }

    /**
     * 
     */
    retrieveKycSessionToken(privateKeyHex, ethAddress, email, organizationId) {
      let defer = $q.defer();

      let store = ConfigFileService.getStore();
      let wallet = store.wallets[$rootScope.wallet.getPublicKeyHex()];

      if (wallet && wallet.sessionsStore && wallet.sessionsStore[organizationId]) {
        defer.resolve(wallet.sessionsStore[organizationId]);
      } else {
        this.retrieveKycSessionToken_register(defer, ethAddress, privateKeyHex, email, organizationId);
      }

      return defer.promise;
    }

    retrieveKycSessionToken_register(defer, ethAddress, privateKeyHex, email, organizationId) {
      let promise = $http.post(KYC_BASE_URL + "organization/" + organizationId + "/claim", {
        "ethAddress": ethAddress,
        "email": email
      });

      promise.then((resp) => {
        if (EthUtils.getWeb3().utils.isHex(resp.data.challenge)) {
          defer.reject("danger_challenge_provided");
        } else {
          this.retrieveKycSessionToken_auth(defer, resp.data.challenge, privateKeyHex);
        }
      }).catch((error) => {
        this.retrieveKycSessionToken_getChallenge(defer, ethAddress, privateKeyHex);
      });
    }

    retrieveKycSessionToken_getChallenge(defer, ethAddress, privateKeyHex) {
      $http.get(KYC_BASE_URL + "walletauth?ethAddress=" + ethAddress).then((resp) => {
        this.retrieveKycSessionToken_auth(defer, resp.data.challenge, privateKeyHex);
      }).catch((error) => {
        defer.reject("challenge_retrieve_error");
      });
    }

    retrieveKycSessionToken_auth(defer, challenge, privateKeyHex) {
      let reqBody = EthUtils.signChallenge(challenge, privateKeyHex);
      // step 3 (authentication)
      $http.post(KYC_BASE_URL + "walletauth", reqBody).then((resp) => {
        defer.resolve(resp.data.token);
      }).catch((error) => {
        defer.reject("auth_error");
      });
    }

    initKycProcess(privateKeyHex, templateId, organizationId, ethAddress, email) {
    }

    getPrices(tokens) {
      let defer = $q.defer();

      // ["KEY", "ETH"]
      let promise = $http.post( KYC_BASE_URL + "rate/tokens/symbol", { "tokens": tokens });

      promise.then((resp) => {
        for (let i in resp.data.items) {
          let item = resp.data.items[i];
          if (item) {
            PRICES[item.symbol] = item;
          }
        }
        $rootScope.PRICES = PRICES;
        defer.resolve($rootScope.PRICES);
      }).catch((error) => {
        defer.reject("CANT_GET_PRICE");
      });

      return defer.promise;
    }

    loadData(reload) {
      // 1: Load Id Attribute Types
      this.dispatchIdAttributeTypes(reload).then((data) => {
        ConfigFileService.setIdAttributeTypes(data);
      });

      // 2: Load ICOs
      this.dispatchIcos(reload).then((data) => {
        for (let i in data) {
          ConfigFileService.addIco(data[i].status, data[i]);
        }
      });

      $rootScope.icos = ConfigFileService.getIcos();
    }
  };

  return new SelfkeyService();
}

module.exports = SelfkeyService;