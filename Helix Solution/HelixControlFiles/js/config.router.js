'use strict';

/**
 * Config for the router
 */

var app = angular.module('app', ['AngularSP', 'ui.router', 'ui.grid', 'ui.grid.cellNav', 'ui.grid.pagination', 'ui.grid.edit', 'ui.grid.resizeColumns', 'ui.grid.pinning', 'ui.grid.selection', 'ui.grid.moveColumns', 'ui.grid.exporter', 'ui.grid.importer', 'ui.grid.grouping', 'ui.grid.autoResize', 'ui.bootstrap', 'oitozero.ngSweetAlert', 'chart.js', 'ui.grid.exporter']);


app.config(['$stateProvider', '$urlRouterProvider', '$controllerProvider', '$compileProvider', '$provide', '$filterProvider', function ($stateProvider, $urlRouterProvider, $controllerProvider, $compileProvider, $provide, $filterProvider) {

    app.controller = $controllerProvider.register;
    app.directive = $compileProvider.directive;
    app.filter = $filterProvider.register;
    app.factory = $provide.factory;
    app.service = $provide.service;
    app.constant = $provide.constant;
    app.value = $provide.value;

    // LAZY MODULES

  

    // APPLICATION ROUTES
    // -----------------------------------
    // For any unmatched url, redirect to /app/dashboard
    $urlRouterProvider.otherwise("/PageNotFound");
    //
    // Set up the states
    $stateProvider.state('PageNotFound', {
        url: "/PageNotFound",
        templateUrl: "../views/PageNotFound.html",

    }).state('details', {
        url: "/details/:AID",
        templateUrl: "../views/ActivityEntryForm.html",

    }).state('dashboard', {
        url: "/dashboard",
        templateUrl: "../views/DashBoard.html",


    }).state('activitydashboard', {
        url: "/activitydashboard",
        templateUrl: "../views/ActivityDashBoard.html",
    }).state('dashboard1', {
            url: "/dashboard1",
            templateUrl: "../views/DashBoard1.html",
    });;

   
    
}]);

