var BaseClass = require('../../www/BaseClass')

describe('BaseClass', function() {
  var model

  beforeEach(function() {
    model = new BaseClass()
  })

  it('triggers event if there are no listeners', function() {
    expect(function() {
      model.trigger('test no listeners')
    }).not.to.throw(Error)
  })

  describe('`on` method', function() {
    var listener
    var anotherListener

    beforeEach(function() {
      listener = spy()
      anotherListener = spy()
    })

    it('calls listener with specified arguments', function() {
      var args = [{}, {}]

      model.on('test', listener)
      model.trigger('test', args[0], args[1])

      expect(listener).to.have.been.called.with.exactly(args[0], args[1])
    })

    it('should not remove another callback when execute called twice', function() {
      var unlisten = model.on('test on listener', listener)

      model.on('test on listener', anotherListener)
      unlisten()
      unlisten()
      model.trigger('test on listener')

      expect(listener).not.to.have.been.called()
      expect(anotherListener).to.have.been.called()
    })

    it('calls two listeners with arguments', function() {
      var args = [{}, {}]

      model.on('two listeners', listener)
      model.on('two listeners', anotherListener)
      model.trigger('two listeners', args[0], args[1])

      expect(listener).to.have.been.called.with.exactly(args[0], args[1])
      expect(anotherListener).to.have.called.with.exactly(args[0], args[1])
    })

    it('calls listener each time event is triggered', function() {
      model.on('all event', listener)
      model.trigger('all event')
      model.trigger('all event')
      model.trigger('all event')

      expect(listener).to.have.been.called.exactly(3)
    })
  })

  describe('`off` method', function() {
    var listener

    beforeEach(function() {
      listener = spy()
    })

    it('removes all listeners', function() {
      model.on('removes listeners', listener)
      model.on('removes another listener', listener)
      model.off()
      model.trigger('removes listeners')
      model.trigger('removes another listener')

      expect(listener).not.to.have.been.called()
    })

    it('removes all listeners for specified event', function() {
      var anotherListener = spy()

      model.on('removes listeners', listener)
      model.on('removes listeners', listener)
      model.on('no removes another listener', anotherListener)
      model.off('removes listeners')
      model.trigger('removes listeners')
      model.trigger('no removes another listener')

      expect(listener).not.to.have.been.called()
      expect(anotherListener).to.have.been.called()
    })

    it('removes specified listeners for specified event', function() {
      model.on('removes listeners', listener)
      model.off('removes listeners', listener)
      model.trigger('removes listeners')

      expect(listener).not.to.have.been.called()
    })
  })

  describe('`one` method', function() {
    it('responds to an event only once', function() {
      var listener = spy()

      model.one('only once', listener)
      model.trigger('only once')
      model.trigger('only once')

      expect(listener).to.have.been.called.once
    })
  })

  describe('`set` method', function() {
    it('sets property', function() {
      var item = {}

      model.set('property', item)

      expect(model.get('property')).to.equal(item)
    })

    it('triggers `${property}_changed` event when property is changed', function() {
      var listener = spy()
      var item = {}

      model.on('property_changed', listener)
      model.set('property', item)

      expect(listener).to.have.been.called()
    })

    it('triggers `${property}_changed` event only when property value is changed', function() {
      var listener = spy()
      var item = {}

      model.on('property_changed', listener)
      model.set('property', item)
      model.set('property', item)

      expect(listener).to.have.been.called.once
    })

    it('triggers `${property}_changed` event with oldValue and currentValue', function() {
      var listener = spy()
      var oldValue = {}
      var currentValue = {}

      model.on('property_changed', listener)
      model.set('property', oldValue)
      model.set('property', currentValue)

      expect(listener).to.have.been.called.with.exactly(oldValue, currentValue)
    })
  })

  describe('`empty` method', function() {
    it('removes all property', function() {
      model.set('property', {})
      model.set('another property', {})
      model.empty()

      expect(model.get('property')).to.be.null
      expect(model.get('another property')).to.be.null
    })
  })

  describe('`bindTo` method', function() {
    var anotherModel

    beforeEach(function() {
      anotherModel = new BaseClass()
    })

    it('synchronizes property between 2 models', function() {
      model.set('active', true)
      model.bindTo('active', anotherModel)
      model.set('active', false)

      expect(anotherModel.get('active')).to.be.false
    })

    it('synchronizes property for 2 models', function() {
      model.bindTo('active', anotherModel, 'visible')
      model.set('active', true)

      expect(anotherModel.get('visible')).to.be.true
    })

    it('triggers `active_changed` for anotherModel', function() {
      var listener = spy()

      anotherModel.on('active_changed', listener)
      model.bindTo('active', anotherModel)
      model.set('active', true)

      expect(listener).to.have.been.called()
    })

    it('triggers `active_changed` for anotherModel equal false', function() {
      var listener = spy()

      anotherModel.on('active_changed', listener)
      model.bindTo('active', anotherModel, null, true)
      model.set('active', false)

      expect(listener).not.to.have.been.called()
    })
  })

  describe('`errorHandler` method', function() {
    it('triggers `error` event when first argument is truthy', function() {
      var handledError

      model.on('error', function(error) {
        handledError = error
      })
      model.errorHandler('test error')

      expect(handledError).to.be.instanceof(Error)
      expect(handledError.message).to.equal('test error')
    })

    it('does not trigger `error` event when first argument is not specified', function() {
      var listener = spy()

      model.on('error', listener)
      model.errorHandler()

      expect(listener).not.to.have.been.called()
    })

    it('is bound to model', function() {
      var handler = model.errorHandler
      var listener = spy()

      model.on('error', listener)
      handler('error')

      expect(listener).to.have.been.called()
    })
  })
})
