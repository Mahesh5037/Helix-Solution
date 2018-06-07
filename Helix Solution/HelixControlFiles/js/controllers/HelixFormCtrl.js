// controller
"use strict"
var app = angular.module('app');
app.controller('ActivityEntryFormCtrl', ["$scope", "$compile", '$rootScope', "$http", "AngularSPREST", "AngularSPCSOM", "$log", 'SweetAlert', '$stateParams', function ($scope, $compile, $rootScope, $http, AngularSPREST, AngularSPCSOM, $log, SweetAlert, $stateParams) {

    $scope.disableActivityName = false;
    $scope.itemId = $stateParams.AID;
    //$scope.disableActivityName = $scope.itemId ? true : false;

    $rootScope.webUrl = "https://share.ey.com/sites/LennoxInternational/DevelopmentSite/";

    $scope.saveButton = true;

    $scope.regex = '^[^@#%?~<>]+$';



    $scope.addTaskRowButton = true;
    $scope.clearTaskRowButton = true;
    $scope.updateTaskRowButton = false;
    $scope.cancelTaskRowButton = false;
    //validating URL Dield
    $scope.checkUrl = function () {
        var actUrl = $scope.folderUrl;
        var relativeUrl = actUrl.replace($scope.webUrl, '');
        //calling IsFolderExist function in AngulaeSPREST
        AngularSPREST.IsFolderExist(relativeUrl, $scope.webUrl).then(function (items) {
            return true;
        }).catch(function (err) {
            if (err.status != 404) {
                var errOptions =
                    {
                        Title: 'LennoxControls',
                        ApplicationFileName: 'ActivityEntryFormCtrl.js',
                        MethodName: 'checkUrl',
                        Exception: err.data.error.message
                    }
                try {
                    AngularSPREST.CreateListItem("LennoxExceptionLogging", $scope.webUrl, errOptions).then(function (items) { });
                }
                catch (ex) {
                    console.log("Error while checking Folder path");
                }
            }
            return false;
        });
    }

    //Clear Reviewer Field on uncheck of isReviewerNeeded Field
    $scope.fieldCheck = function () {
        if (!$scope.isReviewNeeded) {
            $scope.Reviewer = '';
        }
    }
    //Clear Document Url Field on uncheck of IsDocumentNeeded Field

    $scope.fieldCheckDoc = function () {
        if (!$scope.isDocumentNeeded) {
            $scope.folderUrl = '';

        }
    }



    // Date Time Control for disabling the Dates
    $scope.openActStart = function () {
        $scope.popup1.opened = true;
        $scope.options1 = {

        }
    };
    $scope.popup1 = { opened: false };

    $scope.openActEnd = function (startDate) {
        $scope.popup2.opened = true;
        $scope.endDate = $scope.startDate;
        $scope.options2 = {
            minDate: $scope.startDate,
        }
    };
    $scope.popup2 = { opened: false };


    $scope.openTaskStart = function (startDate) {
        $scope.popup3.opened = true;
        $scope.taskstartDate = $scope.startDate;
        $scope.options3 = {
            minDate: $scope.startDate,
            maxDate: $scope.endDate,
        }
    };
    $scope.popup3 = { opened: false };

    $scope.openTaskEnd = function (taskstartDate) {
        $scope.popup4.opened = true;
        $scope.TaskEndDate = $scope.taskstartDate;
        $scope.options4 = {
            minDate: $scope.taskstartDate,
            maxDate: $scope.endDate,
        }
    };
    $scope.popup4 = { opened: false };





    $scope.openCal = function ($event, datePicker) {
        $event.preventDefault();
        $event.stopPropagation();
        $scope[datePicker] = !$scope[datePicker];

    };
    $scope.endOpen = function ($event) {
        $event.preventDefault();
        $event.stopPropagation();
        $scope.startOpened = false;
        $scope.endOpened = !$scope.endOpened;
    };
    $scope.startOpen = function ($event) {
        $event.preventDefault();
        $event.stopPropagation();
        $scope.endOpened = false;
        $scope.startOpened = !$scope.startOpened;
    };

    $scope.dateOptions = {
        formatYear: 'yy',
        startingDay: 1
    };

    $scope.dateOptions1 = {
        formatYear: 'yy',
        startingDay: 1,
        minDate: $scope.minimum
    };
    $scope.formats = ['MM/dd/yyyy', 'dd-MMM-yyyy', 'yyyy/MM/dd', 'dd-MM-yyyy', 'shortDate'];
    $scope.format = $scope.formats[0];
    $scope.hstep = 1;
    $scope.mstep = 15;
    // Time Picker
    $scope.options = {
        hstep: [1, 2, 3],
        mstep: [1, 5, 10, 15, 25, 30]
    };
    $scope.ismeridian = true;
    $scope.toggleMode = function () {
        $scope.ismeridian = !$scope.ismeridian;
    };
    $scope.update = function () {
        var d = new Date();
        d.setHours(14);
        d.setMinutes(0);
        $scope.dt = d;
    };
    $scope.changed = function () {
        $log.log('Time changed to: ' + $scope.dt);
    };
    $scope.clear = function () {
        $scope.dt = null;
    };

    function DateFormat(ModifiedDate) {

        var DateFormat = new Date(ModifiedDate);
        var year = DateFormat.getFullYear();
        var month = DateFormat.getMonth() + 1
        var modifiedDate = year + "-" + month + "-" + DateFormat.getDate() + " " + DateFormat.getHours() + ":" + DateFormat.getMinutes() + ":" + DateFormat.getSeconds();
        return modifiedDate;

    }



    //Grid Declaration


    //Delete Functionality for a Ui-grid Row
    $scope.Delete = function (row) {
        swal({
            title: "Are you sure to Delete the Task?",
            type: "warning",
            showCancelButton: true,
            confirmButtonColor: "#DD6B55", confirmButtonText: "Yes, delete it!",
            cancelButtonText: "No, cancel ",
            closeOnConfirm: false,
            closeOnCancel: false
        }).then(function (isConfirm) {
            if (isConfirm.value == true) {
                if (row.entity.TaskId > 0) {
                    AngularSPREST.DeleteListItem(row.entity.TaskId, 'ActivityTasks', $rootScope.webUrl).then(function (item) {
                        var index = $scope.gridOptions.data.indexOf(row.entity);
                        $scope.gridOptions.data.splice(index, 1);
                        $scope.gridApi.core.refresh();
                        $scope.clearTask();
                        swal("Success", "Your Task is Deleted ", "success");

                    });

                }
                else {

                    var index = $scope.gridOptions.data.indexOf(row.entity);
                    $scope.gridOptions.data.splice(index, 1);
                    $scope.clearTask();
                    swal("Success", "Your Task is Deleted ", "success");
                    $scope.gridApi.core.refresh();


                }
            } else {
                swal("Cancelled", "Your Task is safe ", "error");
            }

        });

    };
    //Ui-Grid Options 
    $scope.gridOptions = {
        enableSorting: false, enablePaging: true,
        paginationPageSizes: [10, 20, 40],
        paginationPageSize: 10,
        enableFiltering: false,
        onRegisterApi: function (gridApi) { $scope.gridApi = gridApi; },

        columnDefs: [
            {
                name: 'ID',
                field: 'ID',
                displayName: 'Id',
                cellTemplate: '<span>{{rowRenderIndex}}</span>',
                visible: false
            },
            {
                field: 'PreparerID',
                name: 'PreparerID',
                visible: false
            },

            {
                field: 'ReviewerID',
                name: 'ReviewerID',
                visible: false
            },

            {
                field: 'TaskId',
                name: 'Task ID',
                visible: false
            },
            {
                field: 'CountryId',
                name: 'Country ID',
                visible: false
            },
            {
                field: 'CountryObj',
                name: 'CountryObj',
                visible: false
            },
            {
                field: 'IsReviewNeeded',
                name: 'IsReviewNeeded',
                visible: false
            },
            {
                field: 'TaskDescription',
                displayName: 'Task Description',
                cellTooltip: function (row, col) {
                    return row.entity.TaskDescription;
                } 

            },
            {
                field: 'Country',
                displayName: 'Country',
                cellTooltip: function (row, col) {
                    return row.entity.Country;
                } 
            },
            {
                field: 'TaskStartDate',
                displayName: 'Start Date',
                visible: false
            },
            {
                field: 'TaskStartDateFormat',
                displayName: 'Start Date',
                cellTooltip: function (row, col) {
                    return row.entity.TaskStartDateFormat;
                } 

            },
            {
                field: 'TaskEndDate',
                displayName: 'End Date',
                visible: false
            },
            {
                field: 'TaskEndDateFormat',
                displayName: 'End Date',
                cellTooltip: function (row, col) {
                    return row.entity.TaskEndDateFormat;
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
                field: 'PreparerObj',
                name: 'PreparerObj',
                visible: false
            },
            {
                field: 'Reviewer',
                displayName: 'Reviewer',
                cellTooltip: function (row, col) {
                    return row.entity.Reviewer;
                } 
            },
            {
                field: 'ReviewerObj',
                name: 'ReviewerObj',
                visible: false
            },
            {
                field: 'IsDocumentNeeded',
                name: 'Is Document Needed',
                visible: false
            },
            {
                field: 'Location',
                name: 'Location',
                visible: false

            },
            {
                field: 'LocationHyperlink',
                name: 'Location',
                //cellTemplate: '<div style="display:{{grid.appscope.doccheck()}}"><a  target="_blank" href="{{row.entity.Location}}"> Folder</a></div>'
                cellTemplate:'<div ng-if="row.entity.IsDocumentNeeded==true"><div ng-show="true"><a target="_blank" href="{{row.entity.Location}}">Folder Link</a></div></div><div ng-if="row.entity.IsDocumentNeeded==flase"><div ng-show="false"><a target="_blank" href="{{row.entity.Location}}">Folder Link</a></div></div>'

            },


            {
                field: 'Action',
                displayName: 'Action',
                cellTemplate: '<img style="height: 11px; margin-left: 10%; width: 11px;"  ng-click="grid.appScope.editTaskRow(row)"  src="../Images/editIcon.png" alt="Edit" /><img style="height: 10px; width: 10px; border:0px;margin-left: 10%"   ng-click="grid.appScope.Delete(row)" src="../Images/DeleteIcon.png" alt="Delete" />'
            }
        ]
    };
    //controlling Folder Hyperlink on Grid
    $scope.docCheck = function () {
        if ($scope.isDocumentNeeded) {
            return block;
        }
        else {
            return none;
        }
    }
    $scope.rowValue = '';
    //Validating the Form on Add Task Button
    $scope.validateTask = function (callBack) {


        var valid = true;
        var uniqueActivity = true;
        var preparerNameExist = false;
        var reviewerNameExist = false;
        var folderPathisValid = true;
        angular.forEach($scope.form.$error, function (field) {
            //if (valid) {
            //    field.$setDirty();
            //    valid = false;
            //}
            if ($scope.form.$error.required) {
                field[0].$setDirty();
                valid = false;
            }
            else if ($scope.form.$error.pattern) {
                field[0].$setDirty();
                valid = false;
            }
            else if ($scope.form.$error.maxlength) {
                field[0].$setDirty();
                valid = false;
            }

        });

        if (valid) {
            angular.forEach($scope.PreparerUsers, function (preparer) {

                if ($scope.Preparer.Title == preparer.Title) {
                    preparerNameExist = true;
                }

            });

            if ($scope.isReviewNeeded && $scope.Reviewer != null && $scope.Reviewer != "") {
                angular.forEach($scope.ReviewerUsers, function (reviewer) {

                    if ($scope.Reviewer.Title == reviewer.Title) {
                        reviewerNameExist = true;
                    }
                })
            }
            else reviewerNameExist = true;

            if ($scope.itemId > 0) {
                angular.forEach($scope.ActivityNameInList, function (actName) {

                    if ($scope.activityName == actName.ActivityName) {
                        if ($scope.itemId != actName.Id) {
                            uniqueActivity = false;
                        }
                    }
                });
            }
            else {
                angular.forEach($scope.ActivityNameInList, function (actName) {

                    if ($scope.activityName == actName.ActivityName) {
                        uniqueActivity = false;
                    }
                });
            }

        }

        if (valid && uniqueActivity && preparerNameExist && reviewerNameExist) {
            if ($scope.isDocumentNeeded) {
                var actUrl = $scope.folderUrl;
                var relativeUrl = actUrl.replace($scope.webUrl, '');

                AngularSPREST.IsFolderExist(relativeUrl, $scope.webUrl).then(function (items) {
                    callBack();

                }).catch(function (err) {
                    if (err.status != 404) {
                        var errOptions =
                            {
                                Title: 'LennoxControls',
                                ApplicationFileName: 'ActivityEntryFormCtrl.js',
                                MethodName: 'checkUrl',
                                Exception: err.data.error.message
                            }
                        try {
                            AngularSPREST.CreateListItem("LennoxExceptionLogging", $scope.webUrl, errOptions).then(function (items) { });
                        }
                        catch (ex) {
                            console.log("Error while checking Folder path");
                        }
                    }
                    else {
                        swal({
                            title: "Invalid Folder URL",
                            type: "warning",
                            showCancelButton: false,
                            confirmButtonClass: "btn-danger",
                            confirmButtonText: "ok",
                            closeOnConfirm: false
                        });

                    }

                });
            }
            else {
                callBack();
            }



        }
        else if (!valid) {

            swal({
                title: "Please fill the mandatory fields",
                type: "warning",
                showCancelButton: false,
                confirmButtonClass: "btn-danger",
                confirmButtonText: "ok",
                closeOnConfirm: false
            });
        }
        else if (!uniqueActivity) {
            if (!$scope.itemId > 0) {
                $scope.activityName = "";
            }

            swal({
                title: "Activity Name already exists",
                type: "warning",
                showCancelButton: false,
                confirmButtonClass: "btn-danger",
                confirmButtonText: "ok",
                closeOnConfirm: false
            });

        }
        else if (!preparerNameExist) {

            swal({
                title: "Please Select a valid Preparer",
                type: "warning",
                showCancelButton: false,
                confirmButtonClass: "btn-danger",
                confirmButtonText: "ok",
                closeOnConfirm: false
            });

        }
        else if (!reviewerNameExist) {

            swal({
                title: "Please Select a valid Reviewer",
                type: "warning",
                showCancelButton: false,
                confirmButtonClass: "btn-danger",
                confirmButtonText: "ok",
                closeOnConfirm: false
            });

        }








    }

    //Update Task function for Grid
    $scope.confirmAndUpdateTask = function () {
        swal(
            { title: 'Are you sure to Update ?', showCancelButton: true, showLoaderOnConfirm: true }).then(
            function (result) {
                if (result.value) {
                    $scope.$apply(function () {
                        var data = $scope.gridOptions.data;

                        var Preparer = $scope.Preparer;
                        var updatedData = data[data.indexOf($scope.rowValue)];
                        updatedData.TaskDescription = $scope.taskDescription;
                        updatedData.Country = $scope.country.Title;
                        updatedData.TaskStartDateFormat = formatDateToString($scope.taskstartDate);
                        updatedData.TaskStartDate = $scope.taskstartDate;
                        updatedData.TaskEndDate = $scope.TaskEndDate;
                        updatedData.TaskEndDateFormat = formatDateToString($scope.TaskEndDate);

                        updatedData.Preparer = Preparer.Title;
                        updatedData.PreparerID = Preparer.Id;
                        updatedData.CountryId = $scope.country.Id;
                        updatedData.IsReviewNeeded = ($scope.isReviewNeeded == undefined) ? false : $scope.isReviewNeeded;
                        updatedData.CountryObj = $scope.country;
                        updatedData.PreparerObj = $scope.Preparer;


                        if ($scope.isReviewNeeded) {
                            var Reviewer = $scope.Reviewer;
                            updatedData.ReviewerID = Reviewer.Id;
                            updatedData.Reviewer = Reviewer.Title;
                            updatedData.ReviewerObj = Reviewer;
                        }
                        else {

                            updatedData.ReviewerID = '';
                            updatedData.Reviewer = '';
                            updatedData.ReviewerObj = '';
                        }
                        if ($scope.isDocumentNeeded) {




                            updatedData.IsDocumentNeeded = $scope.isDocumentNeeded;
                            updatedData.Location = $scope.folderUrl;
                        }
                        else {

                            updatedData.IsDocumentNeeded = $scope.isDocumentNeeded;
                            updatedData.Location = '';
                        }


                        $scope.gridOptions.data.push();
                        $scope.cancelTaskUpdate();
                    });
                } else {
                    // handle all other cases
                }
            });
    }

    //Update Button for a Task
    $scope.updateTaskRow = function () {
        //Validating Task before Updating
        $scope.validateTask($scope.confirmAndUpdateTask);
        
    }
    //Edit Task Row Function
    $scope.editTaskRow = function (row) {




        $scope.rowValue = row.entity;

        $scope.taskDescription = $scope.rowValue.TaskDescription;
        $scope.taskstartDate = $scope.rowValue.TaskStartDate;
        $scope.TaskEndDate = $scope.rowValue.TaskEndDate;
        $scope.isReviewNeeded = $scope.rowValue.IsReviewNeeded;
        // $scope.country = '';
        $scope.Preparer = row.entity.PreparerObj;
        $scope.Reviewer = row.entity.ReviewerObj;
        $scope.country = row.entity.CountryObj;
        $scope.isDocumentNeeded = row.entity.IsDocumentNeeded;
        $scope.folderUrl = row.entity.Location;

        $scope.addTaskRowButton = false;
        $scope.clearTaskRowButton = false;
        $scope.updateTaskRowButton = true;
        $scope.cancelTaskRowButton = true;
    }
    $scope.cancelTaskUpdate = function () {
        $scope.clearTask();
        $scope.addTaskRowButton = true;
        $scope.clearTaskRowButton = true;
        $scope.updateTaskRowButton = false;
        $scope.cancelTaskRowButton = false;
    }

    $('.typeahead').bind('typeahead:select', function (ev, suggestion) {
        $scope.asn = suggestion;
    });

    
    

   
    $scope.empty = '';
    //Clearing Fields on button click
    $scope.clearTask = function (form) {
        $scope.form.$setPristine();
        $scope.taskDescription = $scope.empty;
        $scope.taskstartDate = $scope.empty;
        $scope.TaskEndDate = $scope.empty;
        $scope.isReviewNeeded = false;
        $scope.country = $scope.empty;
        $scope.Preparer = $scope.empty;
        $scope.Reviewer = $scope.empty;
        $scope.isDocumentNeeded = $scope.empty;
        $scope.folderUrl = $scope.empty;

        
    }

    //Add Task to Grid Function
    $scope.confirmAndAddTask = function () {
        swal(
            { title: 'Are you sure?', showCancelButton: true, showLoaderOnConfirm: true }).then(
            function (result) {
                if (result.value) {
                    $scope.$apply(function () {
                        var Preparer = $scope.Preparer;

                        var newrow = { TaskDescription: $scope.taskDescription, Country: $scope.country.Title, TaskStartDateFormat: formatDateToString($scope.taskstartDate), TaskStartDate: $scope.taskstartDate, TaskEndDate: $scope.TaskEndDate, TaskEndDateFormat: formatDateToString($scope.TaskEndDate), Preparer: Preparer.Title, PreparerID: Preparer.Id, CountryId: $scope.country.Id, IsReviewNeeded: ($scope.isReviewNeeded == undefined) ? false : $scope.isReviewNeeded, CountryObj: $scope.country, PreparerObj: $scope.Preparer, Location: $scope.folderUrl, IsDocumentNeeded: $scope.isDocumentNeeded };
                        if ($scope.isReviewNeeded) {
                            var Reviewer = $scope.Reviewer;
                            newrow["ReviewerID"] = Reviewer.Id;
                            newrow["Reviewer"] = Reviewer.Title;
                            newrow["ReviewerObj"] = Reviewer;
                        }

                        $scope.gridOptions.data.push(newrow);
                    });
                } else {
                    // handle all other cases
                }
            });
    }


    //Add a New Task Button
    $scope.addTaskRow = function () {
        //validate Task before Adding
        $scope.validateTask($scope.confirmAndAddTask);

        

    }


    //Display Date Formatting
    function formatDateToString(date) {
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
        return (MM + "/" + dd + "/" + yyyy);
    }
    //to get the Group users
    //Get EY Perparers Group Users
    $scope.getUsersPreparer = function () {


        AngularSPREST.GetGroup("Preparers", true, $rootScope.webUrl).then(function (items) {
            $scope.PreparerUsers = items[0].Users.results;
        }).catch(function (err) {
            var errOptions =
                {
                    Title: 'LennoxControls',
                    ApplicationFileName: 'ActivityEntryFormCtrl.js',
                    MethodName: 'getUsersPreparer',
                    Exception: err.message
                }
            try {
                AngularSPREST.CreateListItem("LennoxExceptionLogging", $scope.webUrl, errOptions).then(function (items) { });
            }
            catch (ex) {
                console.log("Error while Getting User Data from the Group");
            }
        });
    }

    $scope.getUsersPreparer();

    //Get Lennox Perparers Group Users

    //Get EY Reviewers Group Users
    $scope.getUsersReviewer = function () {


        AngularSPREST.GetGroup("Reviewers", true, $rootScope.webUrl).then(function (items) {
            $scope.ReviewerUsers = items[0].Users.results;
        }).catch(function (err) {
            var errOptions =
                {
                    Title: 'LennoxControls',
                    ApplicationFileName: 'ActivityEntryFormCtrl.js',
                    MethodName: 'getUsersReviewer',
                    Exception: err.message
                }
            try {
                AngularSPREST.CreateListItem("LennoxExceptionLogging", $scope.webUrl, errOptions).then(function (items) { });
            }
            catch (ex) {
                console.log("Error while Getting User Data from the Group");
            }
        });
    }
    $scope.getUsersReviewer();
    //Get all Phases from List
    $scope.getPhaseListItems = function () {
        var objToAdd = {};
        var options =
            {
                $select: "Title,Id"
            };
        AngularSPREST.GetListItems("Phase", $rootScope.webUrl, options).then(function (items) {
            $scope.phases = items;
        }).catch(function (err) {
            var errOptions =
                {
                    Title: 'LennoxControls',
                    ApplicationFileName: 'ActivityEntryFormCtrl.js',
                    MethodName: 'getPhaseListItems',
                    Exception: err.message
                }
            try {
                AngularSPREST.CreateListItem("LennoxxceptionLogging", $scope.webUrl, errOptions).then(function (items) { });
            }
            catch (ex) {
                console.log("Error while writing to List due to server issues");
            }
        });
    }
    $scope.getPhaseListItems();
    //Get all Responsibility from List
    $scope.getResponsibilityOptions = function () {
        var objToAdd = {};
        var options =
            {
                $filter: "EntityPropertyName eq ' Responsibility '",
            };
        AngularSPREST.GetChoiceFieldChoices("Activities", $rootScope.webUrl, "Responsibility").then(function (items) {
            $scope.responsibilities = items[0].Choices.results;
        }).catch(function (err) {
            var errOptions =
                {
                    Title: 'LennoxControls',
                    ApplicationFileName: 'ActivityEntryFormCtrl.js',
                    MethodName: 'getResponsibilityOptions',
                    Exception: err.message
                }
            try {
                AngularSPREST.CreateListItem("LennoxxceptionLogging", $scope.webUrl, errOptions).then(function (items) { });
            }
            catch (ex) {
                console.log("Error while writing to List due to server issues");
            }
        });
    }
    $scope.getResponsibilityOptions();

    //Get all countries from List
    $scope.countries = [];
    $scope.getCountryListItems = function () {
        var objToAdd = {};
        var options =
            {
                $select: "Title,Id"
            };
        AngularSPREST.GetListItems("Country", $rootScope.webUrl, options).then(function (items) {
            $scope.countries = items;

        }).catch(function (err) {
            var errOptions =
                {
                    Title: 'LennoxControls',
                    ApplicationFileName: 'ActivityEntryFormCtrl.js',
                    MethodName: 'getCountryListItems',
                    Exception: err.message
                }
            try {
                AngularSPREST.CreateListItem("LennoxxceptionLogging", $scope.webUrl, errOptions).then(function (items) { });
            }
            catch (ex) {
                console.log("Error while writing to List due to server issues");
            }
        });
    }
    $scope.getCountryListItems();

    //Get Activity Name from List for validation
    $scope.getActivityName = function () {
        var options = {
            $select: "ActivityName,Id"
        };
        AngularSPREST.GetListItems("Activities", $rootScope.webUrl, options).then(function (ActivityName) {
            $scope.ActivityNameInList = ActivityName;

        })
    }
    $scope.getActivityName();

    //Saving Activities List Data
    $scope.getData = function () {
        if ($scope.itemId > 0) {
            $scope.saveButton = false;

            var options =
                {
                    $select: "ActivityName,ActivityDescription,PhaseId,Responsibility,StartDate,TaskDueDate",
                    //$expand:"Phase"
                };
            AngularSPREST.GetListItemByID($scope.itemId, "Activities", $rootScope.webUrl, options).then(function (item) {
                $scope.activityName = item.ActivityName;
                $scope.activityDescription = item.ActivityDescription;
                $scope.responsibility = item.Responsibility;
                $scope.startDate = new Date(item.StartDate);
                $scope.endDate = new Date(item.TaskDueDate);
                $scope.phase = item.PhaseId.toString();
                //$scope.phase = $scope.phases.filter(function (phase) {

                //    if (phase.Id == item.Phase.Id) { return phase };
                //});
                $scope.getAllTasks($scope.itemId);


            }).catch(function (err) {
                var errOptions =
                    {
                        Title: 'LennoxControls',
                        ApplicationFileName: 'ActivityEntryFormCtrl.js',
                        MethodName: 'getCountryListItems',
                        Exception: err.message
                    }
                try {
                    AngularSPREST.CreateListItem("LennoxxceptionLogging", $scope.webUrl, errOptions).then(function (items) { });
                }
                catch (ex) {
                    console.log("Error while writing to List due to server issues");
                }
            });
        }
    }
    $scope.tasksData = {};
    //Get Tasks List data From List
    $scope.getAllTasks = function (itemId) {


        var options = {
            $select: "Id,TaskDescription1,TaskDueDate,StartDate,Preparer/Title,Reviewer/Title,Preparer/Id,Reviewer/Id,Country/Title,Country/Id,IsReviewNeeded,Activity/Id,IsDocumentNeeded,FileLocation",
            $filter: "Activity/Id eq " + itemId + "",
            $expand: "Activity,Preparer,Reviewer,Country"
        };
        AngularSPREST.GetListItems("ActivityTasks", $rootScope.webUrl, options).then(function (items) {
            $scope.tasksData = items;
            angular.forEach($scope.tasksData, (function (value, key) {
                var datagrid = value[key];
                
                try {
                    var taskItem = {
                        'TaskId': value.Id,
                        'TaskDescription': value.TaskDescription1,
                        'CountryId': value.Country.Id,
                        'TaskStartDate': new Date(value.StartDate),
                        'TaskEndDate': new Date(value.TaskDueDate),
                        'PreparerID': value.Preparer.Id,
                        'IsReviewNeeded': value.IsReviewNeeded,
                        'Country': value.Country.Title,
                        'Preparer': value.Preparer.Title,
                        'TaskStartDateFormat': formatDateToString(value.StartDate),
                        'TaskEndDateFormat': formatDateToString(value.TaskDueDate),
                        'IsDocumentNeeded': value.IsDocumentNeeded == null ? false : value.IsDocumentNeeded,
                        'Location': value.FileLocation != null ? value.FileLocation.Url:''
                    }
                    $scope.countries.filter(function (country) {

                        if (country.Id == value.Country.Id) { taskItem['CountryObj'] = country };
                    });
                    $scope.PreparerUsers.filter(function (preparer) {

                        if (preparer.Id == value.Preparer.Id) { taskItem['PreparerObj'] = preparer };
                    });


                    if (value.IsReviewNeeded) {
                        taskItem["ReviewerID"] = value.Reviewer.Id;
                        taskItem["Reviewer"] = value.Reviewer.Title;
                        $scope.ReviewerUsers.filter(function (reviewer) {

                            if (reviewer.Id == value.Reviewer.Id) { taskItem['ReviewerObj'] = reviewer };
                        });
                    }

                    $scope.gridOptions.data.push(taskItem);

                }
                catch (ex) {
                    alert(ex);
                }
            }))

        }).catch(function (err) {
            var errOptions =
                {
                    Title: 'LennoxControls',
                    ApplicationFileName: 'ActivityEntryFormCtrl.js',
                    MethodName: 'getAllTasks',
                    Exception: err.message
                }
            try {
                AngularSPREST.CreateListItem("LennoxxceptionLogging", $scope.webUrl, errOptions).then(function (items) { });
            }
            catch (ex) {
                console.log("Error while writing to List due to server issues");
            }
        });
    }
    $scope.getData();

    //Update Data to List
    $scope.updateData = function () {
        var uniqueActivity = true;

        angular.forEach($scope.ActivityNameInList, function (actName) {

            if ($scope.activityName == actName.ActivityName) {
                if ($scope.itemId != actName.Id) {
                    uniqueActivity = false;
                }
            }
        });
        if (uniqueActivity) {
            if ($scope.gridOptions.data.length > 0) {
                swal('Please wait')
                swal.showLoading()
                var activityItem = {
                    "ActivityName": $scope.activityName,
                    "ActivityDescription": $scope.activityDescription,
                    "PhaseId": $scope.phase,
                    "Responsibility": $scope.responsibility,
                    "StartDate": $scope.startDate,
                    "TaskDueDate": $scope.endDate
                }

                try {
                    AngularSPREST.UpdateListItem($scope.itemId, 'Activities', $scope.webUrl, activityItem).then(function (item) {
                        console.log(item);

                        angular.forEach($scope.gridOptions.data, (function (value, key) {
                            var datagrid = value[key];
                            var locationData = {
                                '__metadata': { 'type': 'SP.FieldUrlValue' },
                                'Description': 'Click here',
                                'Url': value.Location
                            }
                            try {
                                var taskItem = {
                                    // 'ActivityId': item.Id,
                                    'TaskDescription1': value.TaskDescription,
                                    'CountryId': value.CountryId,
                                    'StartDate': value.TaskStartDate,
                                    'TaskDueDate': value.TaskEndDate,
                                    'PreparerId': value.PreparerID,
                                    'PreparerEmailId': value.PreparerID,
                                    // 'PreparerSignOff': false,
                                    // 'ReviewerSignOff': false,
                                    // 'TaskStatus': 'Pending with preparer',
                                    'IsReviewNeeded': value.IsReviewNeeded,
                                    'IsDocumentNeeded': value.IsDocumentNeeded
                                }
                                if (value.IsReviewNeeded) {
                                    taskItem["ReviewerId"] = value.ReviewerID;
                                    taskItem["ReviewerEmailId"] = value.ReviewerID;
                                } else {
                                    taskItem["ReviewerId"] = null;
                                    taskItem["ReviewerEmailId"] = null;
                                }
                                if (value.IsDocumentNeeded) {
                                    taskItem["FileLocation"] = locationData;
                                } else {
                                    taskItem["FileLocation"] = null;
                                }
                                if (value.TaskId > 0) {
                                    taskItem["IsTaskUpdated"] = true;
                                    AngularSPREST.UpdateListItem(value.TaskId, 'ActivityTasks', $scope.webUrl, taskItem);

                                } else {
                                    taskItem["PreparerSignOff"] = false;
                                    taskItem["ReviewerSignOff"] = false;
                                    taskItem["ActivityId"] = $scope.itemId;
                                    taskItem["TaskStatus"] = 'Pending with preparer';
                                    AngularSPREST.CreateListItem('ActivityTasks', $scope.webUrl, taskItem);
                                }
                            }
                            catch (ex) {
                                alert(ex);
                            }
                        }))

                        setTimeout(function () {
                            swal({ title: "success", text: "Activity(s) Updated successfully", showCancelButton: false, closeOnConfirm: true }).then(function () {
                                $scope.cancel();
                            });

                        }, 6000);


                    });

                }
                catch (ex) {
                    alert(ex);
                }
            }
            else {
                swal({
                    title: "Add a Task to Submit",

                    type: "warning",
                    showCancelButton: false,
                    confirmButtonClass: "btn-danger",
                    confirmButtonText: "ok",
                    closeOnConfirm: false
                });
            }
        }
        else {
            swal({
                title: "Activity Name already exists",
                type: "warning",
                showCancelButton: false,
                confirmButtonClass: "btn-danger",
                confirmButtonText: "ok",
                closeOnConfirm: false
            });
        }
    };
    //Save Activity and Task data to List
    $scope.saveActivity = function () {
        if ($scope.gridOptions.data.length > 0) {
            swal('Please wait')
            swal.showLoading()
            var activityItem = {
                "ActivityName": $scope.activityName,
                "ActivityDescription": $scope.activityDescription,
                "PhaseId": $scope.phase,
                "Responsibility": $scope.responsibility,
                "StartDate": $scope.startDate,
                "TaskDueDate": $scope.endDate
            }

            try {
                AngularSPREST.CreateListItem('Activities', $scope.webUrl, activityItem).then(function (item) {
                    console.log(item);

                    angular.forEach($scope.gridOptions.data, (function (value, key) {
                        var datagrid = value[key];
                        var locationData = {
                            '__metadata': { 'type': 'SP.FieldUrlValue' },
                            'Description': 'Click here',
                            'Url': value.Location
                        }
                        try {
                            var taskItem = {
                                'ActivityId': item.Id,
                                'TaskDescription1': value.TaskDescription,
                                'CountryId': value.CountryId,
                                'StartDate': value.TaskStartDate,
                                'TaskDueDate': value.TaskEndDate,
                                'PreparerId': value.PreparerID,
                                'PreparerEmailId': value.PreparerID,
                                'PreparerSignOff': false,
                                'ReviewerSignOff': false,
                                'TaskStatus': 'Pending with preparer',
                                'IsReviewNeeded': value.IsReviewNeeded,
                                'IsDocumentNeeded': value.IsDocumentNeeded
                            }
                            if (value.IsReviewNeeded) {
                                taskItem["ReviewerId"] = value.ReviewerID;
                                taskItem["ReviewerEmailId"] = value.ReviewerID;
                            }
                            if (value.IsDocumentNeeded) {
                                taskItem["FileLocation"] = locationData;
                            }
                           
                            AngularSPREST.CreateListItem('ActivityTasks', $scope.webUrl, taskItem);
                            
                        }
                        catch (ex) {
                            alert(ex);
                        }
                    }))

                    setTimeout(function () {
                        swal({ title: "success", text: "Activity(s) added successfully", showCancelButton: false, closeOnConfirm: true }).then(function () {
                            $scope.cancel();
                        });

                    }, 6000);

                });

            }
            catch (ex) {
                alert(ex);
            }
        }
        else {
            swal({
                title: "Add a Task to Submit",

                type: "warning",
                showCancelButton: false,
                confirmButtonClass: "btn-danger",
                confirmButtonText: "ok",
                closeOnConfirm: false
            });
        }
    };
    $scope.cancel = function () {
        // window.location.href=$rootScope.webUrl;
        window.history.back();
    };



}])