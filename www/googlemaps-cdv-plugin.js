/* global cordova, plugin, CSSPrimitiveValue */
var MapsApi = require('./MapsApi');

var mapsApi = new MapsApi();
var SUPPORTS_PASSIVE = false;
document.createElement("div").addEventListener("test", function() {}, {
  get passive() {
    SUPPORTS_PASSIVE = true;
    return false;
  }
});

if (typeof cordova === 'undefined') {
  document.addEventListener("deviceready", function() {
    mapsApi.pause();
  }, {
    once: true
  });
} else {

  var argscheck = require('cordova/argscheck'),
      utils = require('cordova/utils'),
      event = require('./event'),
      common = require('./Common'),
      BaseClass = require('./BaseClass'),
      BaseArrayClass = require('./BaseArrayClass');

  var Map = require('./Map');
  var LatLng = require('./LatLng');
  var LatLngBounds = require('./LatLngBounds');
  var Location = require('./Location');
  var Marker = require('./Marker');
  var Circle = require('./Circle');
  var Polyline = require('./Polyline');
  var Polygon = require('./Polygon');
  var TileOverlay = require('./TileOverlay');
  var GroundOverlay = require('./GroundOverlay');
  var HtmlInfoWindow = require('./HtmlInfoWindow');
  var KmlOverlay = require('./KmlOverlay');
  var encoding = require('./encoding');
  var spherical = require('./spherical');
  var poly = require('./poly');
  var Geocoder = require('./Geocoder');
  var LocationService = require('./LocationService');
  var Environment = require('./Environment');
  var MapTypeId = require('./MapTypeId');
  var DomObserver = require('./DomObserver');
  var MapFactory = require('./MapFactory');

  /*****************************************************************************
   * Prevent background, background-color, background-image properties
   *****************************************************************************/
  var navDecorBlocker = document.createElement("style");
  navDecorBlocker.setAttribute("type", "text/css");
  navDecorBlocker.innerText = [
    "html, body, ._gmaps_cdv_, ._gmaps_cdv_ .nav-decor {",
    "   background: transparent !important;",
    "}",
    "._gmaps_cdv_ .nav-decor {",
    "   display: none !important;",
    "}"
  ].join('');
  document.head.appendChild(navDecorBlocker);

  /*****************************************************************************
   * Add event lister to all html nodes under the <body> tag.
   *****************************************************************************/
  (function observeDOMStructure() {
    if (!document.body || !document.body.firstChild) {
      return common.nextTick(observeDOMStructure);
    }

    var DOM_OBSERVER = new DomObserver();
    var MAP_FACTORY = new MapFactory(DOM_OBSERVER, mapsApi);

    document.body.addEventListener("transitionend", function(e) {
      var target = e.target;

      setTimeout(function() {
        common.nextTick(function() {
          if (target.hasAttribute("__pluginDomId")) {
            DOM_OBSERVER.traceDomTree(target, { 'if': 'isMapChild' });
            isThereAnyChange = true;
            resetTimer({ force: true });
          }
        });
      }, 100);
    }, true);

    var scrollEndTimer = null;
    document.body.addEventListener("scroll", function() {
      clearTimeout(scrollEndTimer);
      scrollEndTimer = setTimeout(onScrollEnd, 100);
      MAP_FACTORY.updateMapsPositions();
    }, true);
    function onScrollEnd() {
      isThereAnyChange = true;
      common.nextTick(putHtmlElements);
    }
    //----------------------------------------------
    // Observe styles and children
    //----------------------------------------------
    var isThereAnyChange = true;
    (function() {

      var observer = new MutationObserver(function(mutations) {
        common.nextTick(function() {
          var i, mutation, node, j, elemId;
          for (j = 0; j < mutations.length; j++) {
            mutation = mutations[j];
            if (mutation.type === "childList") {
              for (i = 0; i < mutation.addedNodes.length; i++) {
                node = mutation.addedNodes[i];
                if (node.nodeType !== Node.ELEMENT_NODE) {
                  continue;
                }
                setDomId(node);
              }
              for (i = 0; i < mutation.removedNodes.length; i++) {
                node = mutation.removedNodes[i];
                if (node.nodeType !== Node.ELEMENT_NODE || !node.hasAttribute("__pluginDomId")) {
                  continue;
                }
                node._isRemoved = true;
                DOM_OBSERVER.removeDomTree(node);
              }
            } else if (mutation.target.nodeType === Node.ELEMENT_NODE && mutation.target.hasAttribute("__pluginDomId")) {
              DOM_OBSERVER.traceDomTree(mutation.target);
            }
          }
          isThereAnyChange = true;
          common.nextTick(putHtmlElements);
        });
      });
      observer.observe(document.body.parentElement, {
        attributes : true,
        childList: true,
        subtree: true,
        attributeFilter: ['style', 'class']
      });

    })();

    function setDomId(element) {
      common.getPluginDomId(element);
      if (element.children) {
        for (var i = 0; i < element.children.length; i++) {
          common.getPluginDomId(element.children[i]);
        }
      }
    }

    var currentOperation = null;

    function rejectOperationIfCancelled(operation, value) {
      if (operation && operation.isCancelled) {
        return Promise.reject(new Error('Stopped by another call of "putHtmlElements"'))
      }

      return value;
    }

    function putHtmlElements() {
      if (currentOperation) {
        currentOperation.isCancelled = true;
      }

      if (!isThereAnyChange || !MAP_FACTORY.hasTouchableMaps()) {
        isThereAnyChange = false;
        return mapsApi.pause();
      }

      common._clearInternalCache();
      DOM_OBSERVER.traceDomTree(document.body);

      var operation = mapsApi.resume()
        .then(function(value) {
          return rejectOperationIfCancelled(operation, value);
        })
        .then(function() {
          return mapsApi.exec('putHtmlElements', [DOM_OBSERVER.positions])
        })
        .then(function(value) {
          return rejectOperationIfCancelled(operation, value);
        })
        .then(function() {
          isThereAnyChange = false;

          if (currentOperation === operation) {
            currentOperation = null;
          }

          return mapsApi.pause();
        })
        .catch(function(error) {
          return operation.isCancelled ? Promise.resolve() : Promise.reject(error);
        });

      currentOperation = operation;

      return operation;
    }

    function resetTimer(opts) {
      opts = opts || {};

      common.nextTick(function() {
        putHtmlElements();
        if (opts.force) {
          MAP_FACTORY.updateMapsPositions(opts);
        }
      });
    }

    document.addEventListener("deviceready", putHtmlElements, {
      once: true
    });
    document.addEventListener("plugin_touch", resetTimer);
    window.addEventListener("orientationchange", function() {
      var cnt = 30;
      resetTimer({force: true});
      var timer = setInterval(function() {
        cnt--;
        if (cnt > 0) {
          MAP_FACTORY.updateMapsPositions();
        } else {
          clearInterval(timer);
        }
      }, 50);
    });

    //----------------------------------------------------
    // Stop all executions if the page will be closed.
    //----------------------------------------------------
    window.addEventListener("unload", function stopExecution() {
      mapsApi.stopExecutionQueue();
    });

    /*****************************************************************************
     * Name space
     *****************************************************************************/
    module.exports = {
      event: event,
      Animation: {
          BOUNCE: 'BOUNCE',
          DROP: 'DROP'
      },

      BaseClass: BaseClass,
      BaseArrayClass: BaseArrayClass,
      Map: {
          getMap: function(div, mapOptions) {
            isThereAnyChange = true;
            return MAP_FACTORY.create(div, mapOptions);
          }
      },
      HtmlInfoWindow: HtmlInfoWindow,
      LatLng: LatLng,
      LatLngBounds: LatLngBounds,
      Marker: Marker,
      MapTypeId: MapTypeId,
      environment: Environment,
      Geocoder: Geocoder,
      LocationService: new LocationService(mapsApi.execInQueue),
      geometry: {
          encoding: encoding,
          spherical: spherical,
          poly: poly
      }
    };

  }());


  cordova.addConstructor(function() {
      if (!window.Cordova) {
          window.Cordova = cordova;
      }
      window.plugin = window.plugin || {};
      window.plugin.google = window.plugin.google || {};
      window.plugin.google.maps = window.plugin.google.maps || module.exports;
      document.addEventListener("deviceready", function() {
          // workaround for issue on android-19: Cannot read property 'maps' of undefined
          if (!window.plugin) { console.warn('re-init window.plugin'); window.plugin = window.plugin || {}; }
          if (!window.plugin.google) { console.warn('re-init window.plugin.google'); window.plugin.google = window.plugin.google || {}; }
          if (!window.plugin.google.maps) { console.warn('re-init window.plugin.google.maps'); window.plugin.google.maps = window.plugin.google.maps || module.exports; }

          // Check the Google Maps Android API v2 if the device platform is Android.
          if (/Android/i.test(window.navigator.userAgent)) {
              //------------------------------------------------------------------------
              // If Google Maps Android API v2 is not available,
              // display the warning alert.
              //------------------------------------------------------------------------
              cordova.exec(null, function(message) {
                  alert(message);
              }, 'Environment', 'isAvailable', ['']);
          }
      }, {
        once: true
      });
  });
}
