
/// <summary>
    ///   Controller
    /// </summary>

var app = angular.module('app');
app.controller('DashBoardCtrl', ["$scope", "$compile", '$rootScope', "$http", "AngularSPREST", "AngularSPCSOM", "$log", 'SweetAlert', '$stateParams',  "uiGridExporterConstants", function ($scope, $compile, $rootScope, $http, AngularSPREST, AngularSPCSOM, $log, SweetAlert, $stateParams, uiGridExporterConstants) {

    $rootScope.webUrl = "https://share.ey.com/sites/LennoxInternational/DevelopmentSite/";
    $scope.date = new Date();
    $scope.phaseItems = [];
    $scope.allTasks = [];
    
    /// <summary>
    ///   Display Date Formatting
    /// </summary>
    function formatDateToExcelString(date) {
        if (angular.isString(date)) {
            date = new Date(date);
        }
        // 01, 02, 03, ... 29, 30, 31
        var dd = (date.getDate() < 10 ? '0' : '') + date.getDate();
        // 01, 02, 03, ... 10, 11, 12
        var MM = ((date.getMonth() + 1) < 10 ? '0' : '') + (date.getMonth() + 1);
        // 1970, 1971, ... 2015, 2016, ...
        var yyyy = date.getFullYear();
        // create the format you want
        return (dd + "-" + MM + "-" + yyyy);
    }
    
    /// <summary>
    ///   Ui-Grid Options
    /// </summary>
    $scope.gridOptions = {
        enableSorting: true, 
        enableFiltering: true,
        onRegisterApi: function (gridApi) { $scope.gridApi = gridApi; },
        columnDefs: [
        

            {
                grouping: { groupPriority: 0 }, sort: { priority: 0, direction: 'asc' },
                field: 'Activity Name',
                name: 'Activity Name',
                groupingShowAggregationMenu: false,
                cellTooltip: function (row, col) {
                    return row.entity["Activity Name"];
                } 
            },
            {

                field: 'Phase',
                displayName: 'Phase',
                enableFiltering: false,
                groupingShowAggregationMenu: false,
                cellTooltip: function (row, col) {
                    return row.entity.Phase;
                } 

            },
            {
                field: 'TaskDescription',
                displayName: 'Task Description',
                enableFiltering: false,
                groupingShowAggregationMenu: false,
                enableFiltering: false, cellTooltip: function (row, col) {
                    return row.entity.TaskDescription;
                } 
            },
            {
                field: 'Country',
                displayName: 'Country',
                groupingShowAggregationMenu: false,
                displayName: 'Country', cellTooltip: function (row, col) {
                    return row.entity.Country;
                } 
            },
            {
                field: 'TaskStartDate',
                displayName: 'Start Date',
                groupingShowAggregationMenu: false,
                cellTooltip: function (row, col) {
                    return row.entity.TaskStartDate;
                } 

            },
            {
                field: 'TaskEndDate',
                displayName: 'End Date',
                groupingShowAggregationMenu: false,
                cellTooltip: function (row, col) {
                    return row.entity.TaskEndDate;
                } 
            },
            {
                field: 'Preparer',
                displayName: 'Preparer',
                groupingShowAggregationMenu: false,
                cellTooltip: function (row, col) {
                    return row.entity.Preparer;
                } 

            },
            {
                field: 'Reviewer',
                displayName: 'Reviewer',
                groupingShowAggregationMenu: false,
                cellTooltip: function (row, col) {
                    return row.entity.Reviewer;
                } 
            },
            {
                field: 'TaskStatus',
                displayName: 'Task Status',
                groupingShowAggregationMenu: false,
                cellTooltip: function (row, col) {
                    return row.entity.TaskStatus;
                } 
            },
            {
                field: 'Status',
                displayName: 'Status',
                cellTemplate: '<div title="{{row.entity.Status}}" class="{{row.entity.Status}}" /> </div>',
                groupingShowAggregationMenu: false
            }
        ],
        
        exporterCsvFilename: 'Tasks.csv',
        exporterCsvLinkElement: angular.element(document.querySelectorAll(".custom-csv-link-location")),
        onRegisterApi: function (gridApi) {
            $scope.gridApi = gridApi;
        }


    };
    
    /// <summary>
    ///    get phases for tabs
    /// </summary>
    $scope.getPhase = function () {
        var options = {
            $select: "Title,Id"
        };
        AngularSPREST.GetListItems("Phase", $rootScope.webUrl, options).then(function (items) {
           // $scope.phaseItems = items;
            angular.forEach(items, (function (value, key) {
                try {
                    value["data"] = $scope.getPieData(value.Title);
                    $scope.phaseItems.push(value);
                }
                catch (ex) {
                    console.log(ex);
                }
            }))

        })
    }
   
    /// <summary>
    ///phase wise completed tasks %
    /// </summary>
    /// <param name="phase">Passing phase as Parameter </param>
    $scope.getPercentageComplete = function (phase) {
        var tasks = $scope.getFilteredData(phase);
        var count = tasks.length;
        if (count > 0) {
            var completedTasks = tasks.filter(function (task) {

                return task.TaskStatus == "Completed";
            });
            return (completedTasks.length / count) * 100;
        }
        else {
            return 0;
        }
    }
    
    /// <summary>
    ///getting data for pie chart
    /// </summary>
    /// <param name="phase">Passing phase as Parameter </param>
    $scope.getPieData = function (phase) {
        var tasks = $scope.getFilteredData(phase);
        var count = tasks.length;
        
        if (count > 0) {
            var completedTasks = tasks.filter(function (task) {

                return task.Status == "completed";
            });
            var inProgressTasks = tasks.filter(function (task) {

                return task.Status == "in_progress";
            });
            var overdueTasks = tasks.filter(function (task) {

                return task.Status == "overdue";
            });
            var yetToStartTasks = tasks.filter(function (task) {

                return task.Status == "yet_to_start";
            });
            var data = [yetToStartTasks.length, inProgressTasks.length, completedTasks.length, overdueTasks.length];
            return data;
            }
        
        else {
            return [0,0,0,0];
        }
 
    }

    
    /// <summary>
    ///phase-wise tasks filtering
    /// </summary>
    /// <param name="phase">Passing phase as Parameter </param>
    $scope.phaseFilter = function (phase) {
        if (phase != undefined) {


            $scope.filteredTaskData = [];
            angular.forEach($scope.allTasks, function (value, key) {
                if (phase == value.Phase) {
                    $scope.filteredTaskData.push(value);

                }
            })
            $scope.gridOptions.data = $scope.filteredTaskData;
            
        }
        else {
            $scope.gridOptions.data = $scope.allTasks;
        }
    }
    /// <summary>
    ///getFilteredData Function Defination
    /// </summary>
    /// <param name="phase">Passing phase as Parameter </param>
    $scope.getFilteredData = function (phase) {
        if (phase != undefined) {


            $scope.filteredTaskData = [];
            angular.forEach($scope.allTasks, function (value, key) {
                if (phase == value.Phase) {
                    $scope.filteredTaskData.push(value);

                }
            })
           return $scope.filteredTaskData;
            
        }
        else {
            return $scope.allTasks;
        }
    }

    
    /// <summary>
    ///rest api call to get ActivityTask data
    /// </summary>
    $scope.getAllTasks = function () {
        $scope.yetToStart = 0;
        $scope.inProgress = 0;
        $scope.overDue = 0;
        $scope.completed = 0;
        $scope.pieData = [];
        var options =
            {
                $select: "Activity/ActivityName,Activity/Id,TaskDescription1,StartDate,TaskDueDate,Preparer/Title,Reviewer/Title,Preparer/Id,Reviewer/Id,TaskStatus,Country/Title",
                $expand: "Activity,Preparer,Reviewer,Country",
                $orderBy: "StartDate",
                $top:"5000"

            };
        AngularSPREST.GetListItems("ActivityTasks", $rootScope.webUrl, options).then(function (items) {
            $scope.taskListData = items;
            
            angular.forEach($scope.taskListData, (function (value, key) {
                try {
                    var taskItem = {
                        'Activity Name': value.Activity.ActivityName,
                        'TaskDescription': value.TaskDescription1,
                        'TaskStartDate': formatDateToExcelString(value.StartDate),
                        'TaskEndDate': formatDateToExcelString(value.TaskDueDate),
                        'Country': value.Country.Title,
                        'Preparer': value.Preparer.Title,
                        'Reviewer': value.Reviewer.Title,
                        'TaskStatus': value.TaskStatus,

                    }
                    var status = 'none';
                    //yet to start
                    if ((value.TaskStatus != 'Completed') && ($scope.date.toISOString() < value.StartDate)) {
                        status = 'yet_to_start';
                        $scope.yetToStart++;
                    }
                    //in Progress
                    else if ((value.TaskStatus != 'Completed') && ($scope.date.toISOString() >= value.StartDate) && ($scope.date.toISOString() < value.TaskDueDate)) {
                        status = 'in_progress';
                        $scope.inProgress++;
                    }
                    //overdue
                    else if ((value.TaskStatus != 'Completed') && ($scope.date.toISOString() > value.TaskDueDate)) {
                        status = 'overdue';
                        $scope.overDue++;
                    }
                    //completed
                    else if (value.TaskStatus == 'Completed') {
                        status = 'completed';
                        $scope.completed++;
                    }
                    taskItem['Status'] = status;
                    var temp = $scope.activitiesListData.filter(function (activity) {

                        return activity.ActivityName == value.Activity.ActivityName;
                    });
                    taskItem['Phase'] = temp[0].Phase.Title;
                    $scope.allTasks.push(taskItem);
                }
                catch (ex) {
                    console.log(ex);
                }
            }
            ))
            $scope.gridOptions.data = $scope.allTasks;
            $scope.getPhase();
            $scope.pieData.push($scope.yetToStart);
            $scope.pieData.push($scope.inProgress);
            $scope.pieData.push($scope.completed);
            
            $scope.pieData.push($scope.overDue);
        })
    }

    
    /// <summary>
    ///rest api to activities data
    /// </summary>
    $scope.getAllActivities = function () {
        var options =
            {
                $select: "ActivityName,Phase/Title",
                $expand: "Phase",
                $orderBy: "StartDate",
                $top:"5000"
            };
        AngularSPREST.GetListItems("Activities", $rootScope.webUrl, options).then(function (items) {
            $scope.activitiesListData = items;
        })
    }

    $scope.getAllActivities();
    $scope.getAllTasks();
    $scope.labels = ['Yet To Start', 'In Progress', 'Completed', 'Overdue'];
    $scope.options = {
        legend: { display: false }

    };
    $scope.colors = ["#D3D3D3", '#ffc04c', '#90EE90', '#ff4c4c'];
    
    /// <summary>
    ///export to excel Function
    /// </summary>
    $scope.ExportToExcel = function () {
        $scope.gridApi.treeBase.expandAllRows();
        window.setTimeout(function () {
            $scope.gridApi.exporter.csvExport(uiGridExporterConstants.VISIBLE, uiGridExporterConstants.ALL);
        });
         
    } 
}])