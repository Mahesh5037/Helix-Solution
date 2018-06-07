
// controller

var app = angular.module('app');
app.controller('DashBoardCtrl1', ["$scope", "$compile", '$rootScope', "$http", "AngularSPREST", "AngularSPCSOM", "$log", 'SweetAlert', '$stateParams',  "uiGridExporterConstants", function ($scope, $compile, $rootScope, $http, AngularSPREST, AngularSPCSOM, $log, SweetAlert, $stateParams, uiGridExporterConstants) {

    $rootScope.webUrl = "https://share.ey.com/sites/LennoxInternational/DevelopmentSite/";
    $scope.date = new Date();
    $scope.phaseItems = [];
    
   
    $scope.allTasks = [];

    $scope.parseDate = function (date) {
        var arr = date.split('-');
        return arr[1] + "/" + arr[0] + "/" + arr[2];
    }


    //Display Date Formatting
    
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
    $scope.gridOptions = {
        enableSorting: true, enablePaging: true,
        paginationPageSizes: [10, 20, 40],
        paginationPageSize: 10,
        enableFiltering: true,
        onRegisterApi: function (gridApi) { $scope.gridApi = gridApi; },

        // showGridFooter: true,
        // gridFooterTemplate: '<div><input float="left" id="taskName" type="text" /></div><div><textarea float="left" id="taskDescription" ></textarea></div><div><input id="taskStartDate"float="left" type="text" /></div><div><input float="left" id="taskEndDate" type="text" /></div>',
        columnDefs: [


            {
                grouping: { groupPriority: 0 }, sort: { priority: 0, direction: 'asc' },
                field: 'Activity Name',
                name: 'Activity Name',
                cellTooltip: function (row, col) {
                    return row.entity["Activity Name"];
                } 

            },
            {

                field: 'Phase',
                displayName: 'Phase',
                enableFiltering: false,
                cellTooltip: function (row, col) {
                    return row.entity.Phase;
                } 
            },
            {
                field: 'TaskDescription',
                displayName: 'Task Description',
                enableFiltering: false, cellTooltip: function (row, col) {
                    return row.entity.TaskDescription;
                } 
            },
            {
                field: 'Country',
                displayName: 'Country', cellTooltip: function (row, col) {
                    return row.entity.Country;
                } 
            },
            {
                field: 'TaskStartDate',
                displayName: 'Start Date',
                cellTooltip: function (row, col) {
                    return row.entity.TaskStartDate;
                } 
                

            },
            {
                field: 'TaskEndDate',
                displayName: 'End Date',
                cellTooltip: function (row, col) {
                    return row.entity.TaskEndDate;
                } 
                
            },
            
            {
                field: 'Preparer',
                displayName: 'Preparer',
                cellTooltip: function (row, col) {
                    return row.entity.Preparer;
                } 

            },
            {
                field: 'Reviewer',
                displayName: 'Reviewer',
                cellTooltip: function (row, col) {
                    return row.entity.Reviewer;
                } 
            },
            {
                field: 'TaskStatus',
                displayName: 'Task Status',
                cellTooltip: function (row, col) {
                    return row.entity.TaskStatus;
                } 
            },
            {
                field: 'Status',
                displayName: 'Status',
                // cellTemplate: '<div class="round" style="background-color: {{row.entity.Status}}" /> </div>',
                cellTemplate: '<div title="{{row.entity.Status}}" class="{{row.entity.Status}}" /> </div>',
            }




        ],
        enableGridMenu: false,
        enableSelectAll: false,
        exporterCsvFilename: 'TaskReport.csv',



        exporterCsvLinkElement: angular.element(document.querySelectorAll(".custom-csv-link-location")),
        onRegisterApi: function (gridApi) {
            $scope.gridApi = gridApi;
        }

    };

    

    
    //get phases for tabs
    $scope.getPhase = function () {
        var options = {
            $select: "Title"
        };
        AngularSPREST.GetListItems("Phase", $rootScope.webUrl, options).then(function (items) {
           // $scope.phaseItems = items;
            angular.forEach(items, (function (value, key) {
                try {
                    value["PercentageComplete"] = $scope.getPercentageComplete(value.Title);
                    $scope.phaseItems.push(value);
                }
                catch (ex) {
                    console.log(ex);
                }
            }))

        })
    }
   
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


    $scope.phaseFilter = function (phase) {
        if (phase != undefined) {


            $scope.filteredTaskData = [];
            angular.forEach($scope.allTasks, function (value, key) {
                if (phase == value.Phase) {
                    $scope.filteredTaskData.push(value);

                }
            })
            $scope.gridOptions.data = $scope.filteredTaskData;
            console.log($scope.filteredTaskData);
        }
        else {
            $scope.gridOptions.data = $scope.allTasks;
        }
    }


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

    //rest api call to get ActivityTask data
    $scope.getAllTasks = function () {
        
        
        var options =
            {
                $select: "Activity/ActivityName,Activity/Id,TaskDescription1,StartDate,TaskDueDate,Preparer/Title,Reviewer/Title,Preparer/Id,Reviewer/Id,TaskStatus,Country/Title",
                $expand: "Activity,Preparer,Reviewer,Country",
                $orderBy: "StartDate"

            };
        AngularSPREST.GetListItems("ActivityTasks", $rootScope.webUrl, options).then(function (items) {
            $scope.taskListData = items;
            console.log(items);
            angular.forEach($scope.taskListData, (function (value, key) {
                try {
                    var taskItem = {
                        'Activity Name': value.Activity.ActivityName,
                        'TaskDescription': value.TaskDescription1,
                        
                        'Country': value.Country.Title,
                        'Preparer': value.Preparer.Title,
                        'Reviewer': value.Reviewer.Title,
                        'TaskStatus': value.TaskStatus,
                        'TaskStartDate': formatDateToExcelString(value.StartDate),
                        'TaskEndDate': formatDateToExcelString(value.TaskDueDate),


                    }
                    var status = 'none';
                    //yet to start
                    if ((value.TaskStatus != 'Completed') && ($scope.date.toISOString() < value.StartDate)) {
                        status = 'yet_to_start';
                        
                    }
                    //in Progress
                    else if ((value.TaskStatus != 'Completed') && ($scope.date.toISOString() >= value.StartDate) && ($scope.date.toISOString() < value.TaskDueDate)) {
                        status = 'in_progress';
                        
                    }
                    //overdue
                    else if ((value.TaskStatus != 'Completed') && ($scope.date.toISOString() > value.TaskDueDate)) {
                        status = 'overdue';
                        
                    }
                    //completed
                    else if (value.TaskStatus == 'Completed') {
                        status = 'completed';
                        
                    }
                    

                    taskItem['Status'] = status;
                    var temp = $scope.activitiesListData.filter(function (activity) {

                        return activity.ActivityName == value.Activity.ActivityName;
                    });
                    taskItem['Phase'] = temp[0].Phase.Title;
                    //looping through two lists to push phase details to tasks

                    $scope.allTasks.push(taskItem);


                }
                catch (ex) {
                    
                }
            }


            ))
           
            $scope.gridOptions.data = $scope.allTasks;
            $scope.getPhase();
            

        })
    }

    //rest api to activities data
    $scope.getAllActivities = function () {
        var options =
            {
                $select: "ActivityName,Phase/Title",
                $expand: "Phase",
                $orderBy: "StartDate"
                //$expand:"Phase"
            };
        AngularSPREST.GetListItems("Activities", $rootScope.webUrl, options).then(function (items) {
            $scope.activitiesListData = items;
            
        })

    }

    $scope.getAllActivities();

    $scope.getAllTasks();
    
    $scope.ExportToExcel = function () {
        $scope.gridApi.treeBase.expandAllRows();
        
        window.setTimeout(function () {
            $scope.gridApi.exporter.csvExport(uiGridExporterConstants.VISIBLE, uiGridExporterConstants.ALL);
                
         
           
        });
         
    }
    
}])