'use strict';

var proxyFactory = require('cjh-remoteServices').proxyFactory;
var socketIO = require('socket.io');
var _ = require('underscore');

module.exports = function (app, options) {
  var io = socketIO(app, options);

  return function (namespace, serviceFactory) {
    var nio;
    if (namespace) {
      nio = io.of('/' + namespace);
    } else {
      nio = io;
    }

    var allMethodHandlers = {};

    var connectSocket = function (socket, serviceName, methodHandlers) {
      socket.join(serviceName);

      _.each(methodHandlers, function (handler, methodName) {
        socket.on(serviceName + '/' + methodName, handler);
      });
    };

    nio.on('connection', function (socket) {
      socket.on('connectToService', function (serviceName, cb) {
        if (serviceFactory) {
          serviceFactory(serviceName).then(function (specAndImpl) {
            if (specAndImpl) {
              createProxy(specAndImpl[0], specAndImpl[1], serviceName);
              connectSocket(socket, serviceName, allMethodHandlers[specAndImpl[0].name]);
              cb(true);
            } else {
              cb(false);
            }
          }, function (error) {
            cb(error);
          });
        } else {
          connectSocket(socket, serviceName, allMethodHandlers);
          cb(true);
        }
      });
    });

    var createProxy = function (serviceSpec, impl, name) {
      var serviceName = name || serviceSpec.name;
      var methodHandlers = {};

      var room = nio.to(serviceName);

      var eventProxyFactory = function (serviceName, eventName) {
        return function (event) {
          room.emit(serviceName + '/' + eventName, event);
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

      if (serviceFactory) {
        allMethodHandlers[serviceSpec.name] = methodHandlers;
      } else {
        allMethodHandlers = methodHandlers;
      }
      proxyFactory.localProxyFactory(serviceSpec, eventProxyFactory, methodProxyFactory)(impl, name);
    };

    if (!serviceFactory) {
      return function (serviceSpec) {
        return function (impl, name) {
          createProxy(serviceSpec, impl, name);
        };
      };
    }
  };
};