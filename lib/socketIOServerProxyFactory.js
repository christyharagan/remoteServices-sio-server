'use strict';

var proxyFactory = require('cjh-remoteServices').proxyFactory;
var socketIO = require('socket.io');
var _ = require('underscore');

module.exports = function (app) {
  var io = socketIO(app);

  return function (serviceSpec) {
    var methodHandlers = {};

    var sio = io.of('/' + serviceSpec.name);
    sio.on('connection', function (socket) {
      _.each(methodHandlers, function (handler, methodName) {
        socket.on(methodName, handler);
      });
    });

    var eventProxyFactory = function (serviceName, eventName) {
      return function (event) {
        sio.emit(eventName, event);
      };
    };
    var methodProxyFactory = function (serviceName, methodName, methodSpec, handler) {
      methodHandlers[methodName] = function (args, cb) {
        handler(args).then(function (ret) {
          cb(ret);
        }, function (err) {
          cb(null, err);
        });
      };
    };

    return proxyFactory.localProxyFactory(serviceSpec, eventProxyFactory, methodProxyFactory);
  };
};