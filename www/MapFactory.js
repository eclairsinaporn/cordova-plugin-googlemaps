var MapView = require('./Map');
var common = require('./Common');

var MAP_CNT = 0;
var SALT_HASH = Math.floor(Math.random() * Date.now());

function MapFactory(observer, mapsApi) {
  this.observer = observer;
  this.mapsApi = mapsApi;
  this.maps = {};
  this.prevMapRects = {};
}

MapFactory.prototype.destroyMap = function destroyMap(id) {
  var map = this.maps[id];

  this.observer.deleteMapFromTree(map.getDiv());
  map.remove();
  delete this.maps[id];

  return map;
};

MapFactory.prototype.create = function createMap(element, options) {
  var mapId;

  if (common.isDom(element)) {
    mapId = element.getAttribute("__pluginMapId");

    if (!options || options.visible !== false) {
      element.classList.add('map-loading');
    }
  }

  if (mapId && this.maps[mapId].getDiv() !== element) {
    this.destroyMap(mapId);
  }

  if (mapId && mapId in this.maps) {
    return this.maps[mapId];
  }

  MAP_CNT++;
  mapId = 'map_' + MAP_CNT + '_' + SALT_HASH;
  var map = new MapView(mapId, this.mapsApi.execInQueue);
  this.maps[mapId] = map;
  this.configureMap(map);

  if (common.isDom(element)) {
    var observer = this.observer;
    var mapsApi = this.mapsApi;

    observer.registerMap(mapId, element);
    mapsApi.exec('resume')
      .then(function() {
        return mapsApi.exec('putHtmlElements', [observer.positions]);
      })
      .then(function() {
        map.getMap(mapId, element, options);
      });
  } else {
    map.getMap(mapId, element, options);
  }

  return map;
};

MapFactory.prototype.configureMap = function(map) {
  var self = this;
  var proxyNativeCall = nativeCallback.bind(map);
  var removeMap = this.destroyMap.bind(this, map);

  document.addEventListener(map.id, proxyNativeCall);
  map.on('div_changed', function(oldDiv, newDiv) {
    if (common.isDom(oldDiv)) {
      oldDiv.removeAttribute('__pluginMapId');
      oldDiv.removeEventListener('gm_destroyed', removeMap);
      self.observer.deleteMapFromTree(oldDiv);
    }

    if (common.isDom(newDiv)) {
      self.observer.registerMap(map.id, newDiv);
      newDiv.addEventListener('gm_destroyed', removeMap);
    }
  });

  map.one('remove', function() {
    document.removeEventListener(map.id, proxyNativeCall);
    var div = map.getDiv() || document.querySelector("[__pluginMapId='" + map.id + "']");

    if (div) {
      div.removeAttribute('__pluginMapId');
      self.deleteMapFromTree(div);
    }

    map.destroy();
    delete self.maps[map.id];
    map = null;

    if (Object.keys(self.maps).length === 0) {
      common._clearInternalCache();
      self.mapsApi.exec('pause');
    }
  });
};

MapFactory.prototype.hasTouchableMaps = function() {
  return Object.keys(this.maps).some(function(id) {
    return this.maps[id].isTouchable();
  }, this);
};

MapFactory.prototype.updateMapsPositions = function(opts) {
  var mapRects = {};
  var prevMapRects = this.prevMapRects;
  var mapIDs = Object.keys(this.maps);
  var hasChanges = false;

  for (var i = 0; i < mapIDs.length; i++) {
    var mapId = mapIDs[i];
    var map = this.maps[mapId];

    if (map.isTouchable()) {
      var mapDiv = map.getDiv();
      var divId = mapDiv.getAttribute("__pluginDomId");
      mapRects[divId] = {
        size: common.getDivRect(mapDiv),
        zIndex: common.getZIndex(mapDiv)
      };
      if (!hasChanges && (divId in prevMapRects) && (
        prevMapRects[divId].size.left !== mapRects[divId].size.left ||
        prevMapRects[divId].size.top !== mapRects[divId].size.top ||
        prevMapRects[divId].size.width !== mapRects[divId].size.width ||
        prevMapRects[divId].size.height !== mapRects[divId].size.height ||
        prevMapRects[divId].zIndex !== mapRects[divId].zIndex)) {
        hasChanges = true;
      }
    }
  }

  this.prevMapRects = mapRects;

  if (hasChanges || opts && opts.force) {
    this.mapsApi.exec('updateMapPositionOnly', [mapRects]);
  }
}

function nativeCallback(params) {
  var args = params.args || [];
  args.unshift(params.evtName);
  this[params.callback].apply(this, args);
}

module.exports = MapFactory;
