<!DOCTYPE html>
<html lang="en" data-ng-app="app">
<head>
    <meta name="WebPartPageExpansion" content="full" />
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
    <meta name="description" content="{{app.description}}">
    <meta name="keywords" content="app, responsive, angular, bootstrap,     , admin">
    <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta name="HandheldFriendly" content="true" />
    <meta name="apple-touch-fullscreen" content="yes" />
    <meta http-equiv="Cache-control" content="no-cache">
    <title data-ng-bind="pageTitle()">Activity Entry Form</title>


    <link href="../css/bootstrap.min.css" rel="stylesheet" />

    <!-- Clip-Two CSS -->

    <link href="../css/styles.css" rel="stylesheet" />
    <link href="../css/font-awesome/css/font-awesome.css" rel="stylesheet" />
    <link href="../css/sweet-alert.css" rel="stylesheet" />
    <link href="../css/sweetalert2.min.css" rel="stylesheet" />
    <link href="../css/circle.css" rel="stylesheet" />
    <link href="../css/angular-chart.css" rel="stylesheet" />



</head>
<body>
    <%@ Register TagPrefix="SharePoint" Namespace="Microsoft.SharePoint.WebControls" Assembly="Microsoft.SharePoint, Version=14.0.0.0, Culture=neutral, PublicKeyToken=71e9bce111e9429c" %>
    <div ui-view id="app"></div>

    <!-- jQuery -->
    <script src="../js/lib/jquery.min.js"></script>

    <!-- Angular -->
    <script src="../js/lib/angular.min.js"></script>


    <script src="../js/angular-ui-router.min.js"></script>
    <script src="../js/lib/ui-bootstrap-tpls-2.5.0.js"></script>
    <script src="../js/lib/sweet-alert.min.js"></script>
    <script src="../js/lib/SweetAlert.min.js"></script>
    <script src="../js/config.router.js"></script>
    <script src="../js/lib/ui-grid.js"></script>
    <script src="../js/lib/core.js"></script>
    <script src="../js/lib/sweetalert2.all.js"></script>
    <script src="../js/lib/Chart.min.js"></script>
    <script src="../js/lib/angular-chart.min.js"></script>



    <!-- Angular SP -->
    <script src="../js/lib/AngularSP.js"></script>



    <script src="../js/controllers/ActivityEntryFormCtrl.js"></script>
    <script src="../js/controllers/DashBoardCtrl.js"></script>
    <script src="../js/controllers/ActivityDashBoardCtrl.js"></script>

    <link href="../css/ui-grid.min.css" rel="stylesheet" />
    <link href="../css/typeaheadjs.css" rel="stylesheet" />
    <script src="../js/lib/typeahead.bundle.min.js"></script>

    <script src="../js/lib/vfs_fonts.js"></script>
    <script src="../js/lib/csv.js"></script>


    <script>

        if (!String.prototype.endsWith) {
            String.prototype.endsWith = function (searchString, position) {
                position = position || 0;
                return this.indexOf(searchString, position) === position;
            };
        }
        // Check if a new cache is available on page load.
        window.addEventListener('load', function (e) {

            window.applicationCache.addEventListener('updateready', function (e) {
                if (window.applicationCache.status == window.applicationCache.UPDATEREADY) {

                    window.applicationCache.swapCache();
                    if (confirm('A new version of this site is available. Load it?')) {
                        window.location.reload();
                    }
                } else {

                }
            }, false);

        }, false);

        document.onkeydown = function (e) {

            var evt = e ? e : window.event;
            if (evt.stopPropagation) evt.stopPropagation();
            if (evt.cancelBubble != null) evt.cancelBubble = true;


            e = e || window.event;  //normalize the evebnt for IE
            var target = e.srcElement || e.target;  //Get the element that event was triggered on
            var tagName = target.tagName;  //get the tag name of the element [could also just compare elements]
            var elem = tagName;
            if (elem !== 'TEXTAREA' && elem !== 'INPUT') {
                return !(e.keyCode === 32);
            }

        };
    </script>
</body>
</html>

