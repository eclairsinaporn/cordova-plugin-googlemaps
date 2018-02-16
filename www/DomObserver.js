var common = require('./Common');

var SKIP_TAGS = { svg: 1, p: 1, pre: 1, script: 1, style: 1 };

function canSkip(element) {
  return SKIP_TAGS[element.tagName.toLowerCase()] || !common.shouldWatchByNative(element);
}

function isEmptyObject(object) {
  if (!object) {
    return true;
  }

  for (var prop in object) {
    if (object.hasOwnProperty(prop)) {
      return false;
    }
  }

  return true;
}

function DomObserver() {
  this.positions = {};
}

DomObserver.prototype.addPosition = function(element) {
  var id = common.getPluginDomId(element);
  var cached = this.positions[id];

  this.positions[id] = {
    pointerEvents: common.getStyle(element, 'pointer-events'),
    size: common.getDivRect(element),
    zIndex: common.getZIndex(element),
    overflowX: common.getStyle(element, "overflow-x"),
    overflowY: common.getStyle(element, "overflow-y"),
    children: [],
    isMap: element.hasAttribute("__pluginMapId"),
    containMapIDs: cached ? cached.containMapIDs : {}
  };

  return this.positions[id];
};

DomObserver.prototype.traceDomTree = function(element, params) {
  if (canSkip(element)) {
    this.removeDomTree(element);
    return;
  }

  var position = this.addPosition(element);
  var options = options || {};
  var isForce = options['if'] && this[options['if']](element);

  if (!isEmptyObject(position.containMapIDs) || isForce || position.isMap || position.pointerEvents === "none") {
    var children = element.getElementsByTagName('*');

    for (var i = 0; i < children.length; i++) {
      var child = children[i];

      if (canSkip(child)) {
        continue;
      }

      this.addPosition(child);
      var parentPosition = this.getOrCreatePosition(child.parentNode);

      parentPosition.children.push(common.getPluginDomId(child));
    }
  }
};

DomObserver.prototype.removeDomTree = function(element) {
  if (!element || !element.querySelectorAll) {
    return;
  }

  var children = Array.prototype.slice.call(element.querySelectorAll('[__pluginDomId]'), 0);

  if (element.hasAttribute('__pluginDomId')) {
    children.push(element);
  }

  var isRemoved = element._isRemoved;
  for (var i = 0; i < children.length; i++) {
    var child = children[i];

    if (isRemoved) {
      this.cleanUp(child);
    }

    common._removeCacheById(common.getPluginDomId(child));
  }
};

DomObserver.prototype.getOrCreatePosition = function(element) {
  return this.positions[common.getPluginDomId(element)] || this.addPosition(element);
};

DomObserver.prototype.cleanUp = function(element) {
  var elemId = common.getPluginDomId(element);

  element.removeAttribute('__pluginDomId');

  if (element.hasAttribute('__pluginMapId')) {
    var event = document.createEvent('Events');
    event.initEvent('gm_destroyed', false, false);
    element.dispatchEvent(event);
  }

  delete this.positions[elemId];
};

DomObserver.prototype.deleteMapFromTree = function(mapNode) {
  var elem = mapNode;
  var mapId = mapNode.getAttribute('__pluginMapId');

  while(elem && elem.nodeType === Node.ELEMENT_NODE) {
    var elemId = elem.getAttribute("__pluginDomId");

    if (elemId && elemId in this.positions) {
      delete this.positions[elemId].containMapIDs[mapId];

      if (isEmptyObject(this.positions[elemId].containMapIDs)) {
        delete this.positions[elemId];
      }
    }

    elem.classList.remove('_gmaps_cdv_');
    elem = elem.parentNode;
  }
};

DomObserver.prototype.registerMap = function(mapId, mapNode) {
  mapNode.setAttribute('__pluginMapId', mapId);

  var elem = mapNode;
  while (elem.nodeType === Node.ELEMENT_NODE) {
    var position = this.addPosition(elem);
    position.containMapIDs[mapId] = 1;
    elem = elem.parentNode;
  }
}

module.exports = DomObserver;
