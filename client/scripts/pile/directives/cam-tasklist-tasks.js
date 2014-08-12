define([
  'angular',
  'moment',
  'text!./cam-tasklist-tasks.html'
], function(
  angular,
  moment,
  template
) {
  'use strict';

  function itemById(items, id) {
    var i, item;
    for (i in items) {
      item = items[i];
      if (item.id === id) { return item; }
    }
  }

  return [
    '$modal',
    '$location',
    '$rootScope',
    '$timeout',
    '$q',
    'camTasklistPileFilterConversion',
    'camAPI',
  function(
    $modal,
    $location,
    $rootScope,
    $timeout,
    $q,
    camTasklistPileFilterConversion,
    camAPI
  ) {
    var Task = camAPI.resource('task');

    return {
      template: template,

      link: function(scope) {
        var dateExp = /(Before|After)$/;

        scope.pageSize = 15;
        scope.pageNum = 1;
        scope.totalItems = 0;

        scope.now = new Date();

        scope.loading = false;

        scope.tasks = scope.tasks || [];

        scope.pile = scope.pile || $rootScope.currentPile;

        scope.searchTask = '';

        scope.sorting = angular.element('[cam-sorting-choices]').scope();

        scope.sorting.$on('sorting.by.change', loadTasks);

        scope.sorting.$on('sorting.order.change', loadTasks);


        function setCurrentTask(task) {
          if (task) {
            $location.search({
              // tasks: scope.pile.id,
              task: task.id
            });
          }
          $rootScope.currentTask = task;
          $rootScope.$broadcast('tasklist.task.current');
        }


        function loadTasks() {
          scope.loading = true;
          scope.tasks = [];

          var where = buildWhere(scope.sorting.order, scope.sorting.by);

          Task.list(where, function(err, res) {
            scope.loading = false;
            if (err) { throw err; }

            // update the URL of the page
            $location.search({
              tasks:      scope.pile.id,
              sortOrder:  where.sortOrder || 'desc',
              sortBy:     where.sortBy || 'priority'
            });


            scope.totalItems = res.count;
            scope.processDefinitions = res._embedded.processDefinition;
            // TODO: refactor that when #CAM-2550 done
            scope.tasks = res._embedded.task || res._embedded.tasks;
          });
        }


        function buildWhere(order, by) {
          var where = {};
          angular.forEach(scope.pile.filters, function(pair) {
            where[pair.key] = camTasklistPileFilterConversion(pair.value);
            if (dateExp.test(pair.key)) {
              /* jshint evil: true */
              var date = new Date(eval(where[pair.key]) * 1000);
              /* jshint evil: false */
              date = moment(date);
              where[pair.key] = date.toISOString();
            }
          });

          where.firstResult = (scope.pageNum - 1) * scope.pageSize;
          where.maxResults = scope.pageSize;

          if (order && by) {
            where.sortBy = by;
            where.sortOrder = order;
          }

          return where;
        }


        scope.pageChange = loadTasks;


        scope.lookupTask = function(val) {
          var deferred = $q.defer();

          scope.loading = true;

          var where = buildWhere(scope.sorting.order, scope.sorting.by);

          where.nameLike = '%'+ val +'%';

          Task.list(where, function(err, res) {
            scope.loading = false;

            if (err) {
              return deferred.reject(err);
            }

            deferred.resolve(res._embedded.tasks);
          });

          return deferred.promise;
        };


        scope.selectedTask = function($item) {
          setCurrentTask($item);
          scope.searchTask = '';
        };


        scope.focus = function(delta) {
          setCurrentTask(scope.tasks[delta]);
        };



        $rootScope.$on('$locationChangeSuccess', function() {
          var state = $location.search();
          if (state.task) {
            if ($rootScope.currentTask && state.task === $rootScope.currentTask.id) {
              return;
            }

            setCurrentTask(itemById(scope.tasks, state.task));
          }
          else {
            scope.sorting.order = state.sortOrder;
            scope.sorting.by = state.sortBy;
          }
        });

        scope.$on('tasklist.task.complete', function() {
          setCurrentTask(null);
          loadTasks();
        });

        scope.$on('tasklist.pile.current', function() {
          if (
            !$rootScope.currentPile ||
            (scope.pile && (scope.pile.id === $rootScope.currentPile.id))
          ) {
            return;
          }
          scope.pile = $rootScope.currentPile;
          loadTasks();
        });
      }
    };
  }];
});
