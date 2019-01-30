'use strict';

var fs = require('fs');
var angular = require('angular');

var template = fs.readFileSync(__dirname + '/decision-instance-table.html', 'utf8');
var decisionSearchConfig = JSON.parse(fs.readFileSync(__dirname + '/decision-instance-search-config.json', 'utf8'));

module.exports = [ 'ViewsProvider', function(ViewsProvider) {

  ViewsProvider.registerDefaultView('cockpit.decisionDefinition.tab', {
    id: 'decision-instances-table',
    label: 'DECISION_DEFINITION_LABEL',
    template: template,
    controller: [
      '$scope', '$location', 'search', 'routeUtil', 'camAPI', 'Views', '$translate', 'localConf',
      function($scope,   $location,   search,   routeUtil,   camAPI,   Views, $translate, localConf) {

        $scope.headColumns = [
          { class: 'instance-id',    request: ''          , sortable: false, content: $translate.instant('PLUGIN_DECISION_ID')},
          { class: 'start-time',     request: 'evaluationTime'     , sortable: true, content: $translate.instant('PLUGIN_DECISION_EVALUATION_TIME')},
          { class: 'definition-key', request: '', sortable: false, content: $translate.instant('PLUGIN_DECISION_CALLING_PROCESS_CASE')},
          { class: 'instance-id',    request: '', sortable: false, content: $translate.instant('PLUGIN_DECISION_CALLING_INSTANCE_ID')},
          { class: 'activity-id',    request: '', sortable: false, content: $translate.instant('PLUGIN_DECISION_ACTIVITY_ID')}
        ];

        // Default sorting
        var defaultValue = { sortBy: 'evaluationTime', sortOrder: 'desc'};
        $scope.sortObj   = loadLocal(defaultValue);


        var processInstancePlugins = Views.getProviders({ component: 'cockpit.processInstance.view' });
        var hasHistoryPlugin = processInstancePlugins.filter(function(plugin) {
          return plugin.id === 'history';
        }).length > 0;

        $scope.hasCasePlugin = false;
        try {
          $scope.hasCasePlugin = !!angular.module('cockpit.plugin.case');
        }
        catch (e) {
          // do nothing
        }

        $scope.getProcessDefinitionLink = function(decisionInstance) {
          if(hasHistoryPlugin) {
            return '#/process-definition/' + decisionInstance.processDefinitionId + '/history';
          } else {
            return '#/process-definition/' + decisionInstance.processDefinitionId;
          }
        };

        $scope.getProcessInstanceLink = function(decisionInstance) {
          if(hasHistoryPlugin) {
            return '#/process-instance/' + decisionInstance.processInstanceId + '/history' +
            '?activityInstanceIds=' + decisionInstance.activityInstanceId +
            '&activityIds=' + decisionInstance.activityId;
          } else {
            return '#/process-instance/' + decisionInstance.processInstanceId;
          }
        };

        $scope.getActivitySearch = function(decisionInstance) {
          return JSON.stringify([{
            type: 'caseActivityIdIn',
            operator: 'eq',
            value: decisionInstance.activityId
          }]);
        };

        $scope.searchConfig = angular.copy(decisionSearchConfig);
        angular.forEach(decisionSearchConfig.tooltips, function(translation, tooltip) {
          $scope.searchConfig.tooltips[tooltip] = $translate.instant(translation);
        });

        $scope.searchConfig.types.map(function(type) {
          type.id.value = $translate.instant(type.id.value);
          if (type.operators) {
            type.operators = type.operators.map(function(op) {
              op.value = $translate.instant(op.value);
              return op;
            });
          }
          return type;
        });

        var historyService = camAPI.resource('history');

        $scope.onSearchChange = updateView;
        $scope.onSortChange = updateView;


        function updateView(searchQuery, pages, sortObj) {
          $scope.pagesObj = pages   || $scope.pagesObj;
          $scope.sortObj  = sortObj || $scope.sortObj;

          // Add default sorting param
          if(sortObj) {
            saveLocal(sortObj);
          }

          var page = $scope.pagesObj.current,
              count = $scope.pagesObj.size,
              firstResult = (page - 1) * count;

          $scope.decisionInstances = null;
          $scope.loadingState = 'LOADING';
          
          var decisionInstanceQuery = angular.extend(
            {
              decisionDefinitionId: $scope.decisionDefinition.id,
              firstResult: firstResult,
              maxResults: count,
              sortBy: $scope.sortObj.sortBy,
              sortOrder: $scope.sortObj.sortOrder
            },
            searchQuery
          );

          var countQuery = angular.extend(
            {
              decisionDefinitionId: $scope.decisionDefinition.id
            },
            searchQuery
          );

          return historyService
            .decisionInstanceCount(countQuery)
            .then(function(data) {
              var total = data.count;

              return historyService
                .decisionInstance(decisionInstanceQuery)
                .then(function(data) {
                  $scope.decisionInstances = data;
                  $scope.loadingState = data.length ? 'LOADED' : 'EMPTY';

                  return total;
                }).catch(angular.noop);
            }).catch(angular.noop);
        }

        function saveLocal(sortObj) {
          localConf.set('sortDecInstTab', sortObj);

        }
        function loadLocal(defaultValue) {
          return localConf.get('sortDecInstTab', defaultValue);
        }



      }],
    priority: 10
  });
}];
