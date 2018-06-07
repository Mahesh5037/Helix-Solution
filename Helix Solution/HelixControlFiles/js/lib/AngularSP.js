/////////////////////////////////////////////////////////////////////////////////////////////////////////
///
///         AngularSP version 0.0.0.6
///         Created by Ryan Schouten, @shrpntknight, https://angularsp.codeplex.com
///
////////////////////////////////////////////////////////////////////////////////////////////////////////
var angularSP = angular.module('AngularSP', []);
angularSP.service('AngularSPREST', ['$http', '$q', function ($http, $q) {
    //Private Variables
    var self = this;
    var cachedDigests = [];

    //Methods
    
    this.GetUpdatedDigest = function GetUpdateDigest(webUrl, hostUrl) {
        var deff = $q.defer();
        webUrl = self.SanitizeWebUrl(webUrl);

        var needToAdd = false;
        var digest = self.Support.GetDigestFromCache(webUrl, hostUrl);
        needToAdd = digest === null;
        if (digest != null && digest.digestData != null && digest.digestExpires.getTime() > new Date().getTime()) {
            deff.resolve(digest.digestData);
        }
        else {
            var __REQUESTDIGEST;
            var contextInfoPromise = $http({
                url: webUrl + "_api/contextinfo",
                method: "POST",
                headers: {
                    "Accept": "application/json; odata=verbose"
                }
            }).then(function (data) {
                if (needToAdd) {
                    digest = { digestData: null, digestExpires: null, webUrl: webUrl + hostUrl };
                    cachedDigests.push(digest);
                }
                digest.digestData = self.Support.GetJustTheData(data).GetContextWebInformation;
                var timeout = digest.digestData.FormDigestTimeoutSeconds;
                var now = new Date();
                digest.digestExpires = new Date(now.getTime() + timeout * 1000);
                deff.resolve(digest.digestData);
            }, function (sender, args) {
                console.log("Error getting new digest");
                deff.reject(args);
            });
        }
        return deff.promise;
    }
    this.GetItemTypeForListName = function GetItemTypeForListName(name) {
        name = name.replace(/_/g, '_x005f_').replace(/-/g, '');
        return "SP.Data." + name.charAt(0).toUpperCase() + name.split(" ").join("").slice(1) + "ListItem";
    }
    this.GetUrlPrefix = function GetUrlPrefix() {
        if (self.IsSharePointHostedApp) {

        }
    }
    this.Support = {
        GetJustTheData: function GetJustTheData(value) {
            var tmp = value;
            if (typeof (tmp.data) !== "undefined") {
                tmp = tmp.data;
            }
            if (typeof (tmp.d) !== "undefined") {
                tmp = tmp.d;
            }
            if (typeof (tmp.results) !== "undefined")
                tmp = tmp.results;
            return tmp;
        },
        EndsWith: function endsWith(str, suffix) {
            return str.indexOf(suffix, str.length - suffix.length) !== -1;
        },
        GetCurrentDigestValue: function GetCurrentDigestValue(webUrl, hostUrl) {
            webUrl = self.SanitizeWebUrl(webUrl);
            var digest = self.Support.GetDigestFromCache(webUrl, hostUrl);
            if (digest != null && digest.digestData != null && digest.digestExpires.getTime() > new Date().getTime()) {
                return digest.digestData.FormDigestValue;
            }
            else {
                return $("#__REQUESTDIGEST").val();
            }
        },
        GetDigestFromCache: function GetDigestFromCache(webUrl, hostUrl) {
            for (var i = 0; i < cachedDigests.length; i++) {
                if (cachedDigests[i].webUrl == webUrl + hostUrl)
                    return cachedDigests[i];
            }
            return null;
        },
        SendRequestViaExecutor: function SendRequestViaExecutor(url, appWebUrl, hostUrl, data, method, headers) {
            if (typeof (method) === "undefined" || method === null)
                method = "GET";

            var executor = new SP.RequestExecutor(appWebUrl);

            var context = {
                promise: $q.defer()
            };
            if (url.indexOf("?") > 0)
                url += "&";
            else
                url += "?";

            var requestObj = {
                url:
                    appWebUrl +
                    "_api/SP.AppContextSite(@target)" + url + "@target='" +
                    hostUrl + "'",
                method: method,
                headers: { "Accept": "application/json; odata=verbose" },
                success: Function.createDelegate(context, function (data) {
                    if (data.body === "")
                        data.body = "{}";
                    this.promise.resolve(JSON.parse(data.body));
                }),
                error: Function.createDelegate(context, function (data) {
                    if (data.body === "")
                        data.body = "{}";
                    this.promise.reject(JSON.parse(data.body));
                })
            };
            if (typeof (headers) !== "undefined") {
                for (var key in headers) {
                    if (headers.hasOwnProperty(key)) {
                        requestObj.headers[key] = headers[key];
                    }
                }
            }
            if (typeof (data) !== "undefined" && data != null) {
                requestObj.body = JSON.stringify(data);
                requestObj.headers["content-type"] = "application/json;odata=verbose";

                /*if(!create)
                {
                    requestObj.headers["If-Match"] = "*";
                    requestObj.headers["X-HTTP-Method"] = "MERGE";
                }*/
            }
            executor.executeAsync(requestObj);
            return context.promise.promise;
        }
    }
    this.SanitizeWebUrl = function SanitizeWebUrl(url) {
        if (typeof (url) == "undefined" || url == null || url == "")
            url = _spPageContextInfo.siteAbsoluteUrl;
        //if (url.endsWith("/") === false)
        //    url += "/";
        return url;
    }
    this.CreateListItem = function CreateListItem(listName, webUrl, item, hostUrl) {
        var itemType = self.GetItemTypeForListName(listName);
        var url = "/web/lists/getbytitle('" + listName + "')/items";
        item["__metadata"] = { "type": itemType };
        webUrl = self.SanitizeWebUrl(webUrl);

        var deff = $q.defer();
        $q.when(self.GetUpdatedDigest(webUrl)).then(function () {
            var promise;
            if (typeof (hostUrl) === "undefined" || hostUrl === null || hostUrl === "") {
                promise = $http({
                    url: webUrl + "_api" + url,
                    method: "POST",
                    data: item,
                    headers: {
                        "Accept": "application/json;odata=verbose",
                        'Content-Type': 'application/json;odata=verbose',
                        "X-RequestDigest": self.Support.GetCurrentDigestValue(webUrl)
                    }
                });
            }
            else {
                promise = self.Support.SendRequestViaExecutor(url, webUrl, hostUrl, item, "POST");
            }
            promise.then(function (data) { deff.resolve(self.Support.GetJustTheData(data)) }, function (data) { deff.reject(data) });
        });
        return deff.promise;
    }
    this.CreateListItemsync = function CreateListItemsync(listName, webUrl, item, hostUrl) {
        var itemType = self.GetItemTypeForListName(listName);
        var url = "/web/lists/getbytitle('" + listName + "')/items";
        item["__metadata"] = { "type": itemType };
        webUrl = self.SanitizeWebUrl(webUrl);

        var deff = $q.defer();
        $q.when(self.GetUpdatedDigest(webUrl)).then(function () {
            var promise;
            if (typeof (hostUrl) === "undefined" || hostUrl === null || hostUrl === "") {
                promise = $http({
                    url: webUrl + "_api" + url,
                    method: "POST",
                    data: item,
                    async: false,
                    headers: {
                        "Accept": "application/json;odata=verbose",
                        'Content-Type': 'application/json;odata=verbose',
                        "X-RequestDigest": self.Support.GetCurrentDigestValue(webUrl)
                    }
                });
            }
            else {
                promise = self.Support.SendRequestViaExecutor(url, webUrl, hostUrl, item, "POST");
            }
            promise.then(function (data) { deff.resolve(self.Support.GetJustTheData(data)) }, function (data) { deff.reject(data) });
        });
        return deff.promise;
    }

    this.CreateListItem2 = function CreateListItem2(listDispName,listItemType, webUrl, item, hostUrl) {
        var itemType = listItemType;
        var url = "/web/lists/getbytitle('" + listDispName + "')/items";
        item["__metadata"] = { "type": itemType };
        webUrl = self.SanitizeWebUrl(webUrl);

        var deff = $q.defer();
        $q.when(self.GetUpdatedDigest(webUrl)).then(function () {
            var promise;
            if (typeof (hostUrl) === "undefined" || hostUrl === null || hostUrl === "") {
                promise = $http({
                    url: webUrl + "_api" + url,
                    method: "POST",
                    data: item,
                    headers: {
                        "Accept": "application/json;odata=verbose",
                        'Content-Type': 'application/json;odata=verbose',
                        "X-RequestDigest": self.Support.GetCurrentDigestValue(webUrl)
                    }
                });
            }
            else {
                promise = self.Support.SendRequestViaExecutor(url, webUrl, hostUrl, item, "POST");
            }
            promise.then(function (data) { deff.resolve(self.Support.GetJustTheData(data)) }, function (data) { deff.reject(data) });
        });
        return deff.promise;
    }


    this.GetItemById = function GetItemById(itemId, listName, webUrl, extraParams, hostUrl) {
        webUrl = self.SanitizeWebUrl(webUrl);
        var url = "/web/lists/getbytitle('" + listName + "')/items(" + itemId + ")";
        if (typeof (extraParams) != "undefined" && extraParams != "") {
            url += "?" + extraParams;
        }

        var deff = $q.defer();
        var promise;
        if (typeof (hostUrl) === "undefined" || hostUrl === null || hostUrl === "") {
            url = webUrl + "_api" + url;
            promise = $http({
                url: url,
                method: "GET",
                headers: { "Accept": "application/json; odata=verbose" }
            });
        }
        else {
            promise = self.Support.SendRequestViaExecutor(url, webUrl, hostUrl, null, "GET");
        }

        promise.then(function (data) { deff.resolve(self.Support.GetJustTheData(data)) }, function (data) { deff.reject(data) });
        return deff.promise;

        return promise;
    }

    this.GetListDetailsByInternalName = function GetListDetailsByInternalName(listInternalName, webUrl) {
        webUrl = self.SanitizeWebUrl(webUrl);

        var url = "/web/lists?$filter=RootFolder/Name eq '" + listInternalName + "'";

        var promise;

        url = webUrl + "_api" + url;
        promise = $http({
            url: url,
            method: "GET",
            headers: { "Accept": "application/json; odata=verbose" }
        });


        var deff = $q.defer();
        promise.then(function (data) {
            deff.resolve(self.Support.GetJustTheData(data))
        }, function (data) {
            deff.reject(data)
        });
        return deff.promise;
    }

    this.CreateInternalListItem = function CreateListItem(listName, webUrl, item, itemType,hostUrl) {
        //  var itemType = self.GetItemTypeForListName(listName);
        var url = "/web/lists/getbytitle('" + listName + "')/items";
        item["__metadata"] = { "type": itemType };
        webUrl = self.SanitizeWebUrl(webUrl);

        var deff = $q.defer();
        $q.when(self.Digest(webUrl)).then(function () {
            var promise;
            if (typeof (hostUrl) === "undefined" || hostUrl === null || hostUrl === "") {
                promise = $http({
                    url: webUrl + "_api" + url,
                    method: "POST",
                    data: item,
                    headers: {
                        "Accept": "application/json;odata=verbose",
                        'Content-Type': 'application/json;odata=verbose',
                        "X-RequestDigest": self.Support.GetCurrentDigestValue(webUrl)
                    }
                });
            }
            else {
                promise = self.Support.SendRequestViaExecutor(url, webUrl, hostUrl, item,"POST");
            }
            promise.then(function (data) { deff.resolve(self.Support.GetJustTheData(data)) },function (data) { deff.reject(data) });
        });
        return deff.promise;
    }


    this.GetListItems = function GetListItems(listName, webUrl, options, hostUrl) {
        webUrl = self.SanitizeWebUrl(webUrl);

        if (typeof (options) === "string")
            options = { $filter: options };

        var url = "/web/lists/getbytitle('" + listName + "')/items";
        if (typeof (options) !== "undefined") {
            var odata = "";
            for (var property in options) {
                if (options.hasOwnProperty(property)) {
                    if (property === "LoadPage") {
                        url = options[property];
                        break;
                    }
                    if (odata.length == 0)
                        odata = "?";
                    odata += property + "=" + options[property] + "&";
                }
            }
            if (odata.lastIndexOf("&") == odata.length - 1) {
                odata = odata.substring(0, odata.length - 1);
            }
            url += odata;
        }
        var promise;
        if (typeof (hostUrl) === "undefined" || hostUrl === null) {
            url = webUrl + "_api" + url;
            promise = $http({
                url: url,
                method: "GET",
                headers: { "Accept": "application/json; odata=verbose" }
            });
        }
        else {
            promise = self.Support.SendRequestViaExecutor(url, webUrl, hostUrl, null, "GET");
        }
        var deff = $q.defer();
        promise.then(function (data) { deff.resolve(self.Support.GetJustTheData(data)) }, function (data) { deff.reject(data) });
        return deff.promise;
    }


    this.GetListFieldItems = function GetListItems(listName, webUrl, options, hostUrl) {
        webUrl = self.SanitizeWebUrl(webUrl);

        if (typeof (options) === "string")
            options = { $filter: options };

        var url = "/web/lists/getbytitle('" + listName + "')/fields";
        if (typeof (options) !== "undefined") {
            var odata = "";
            for (var property in options) {
                if (options.hasOwnProperty(property)) {
                    if (property === "LoadPage") {
                        url = options[property];
                        break;
                    }
                    if (odata.length == 0)
                        odata = "?";
                    odata += property + "=" + options[property] + "&";
                }
            }
            if (odata.lastIndexOf("&") == odata.length - 1) {
                odata = odata.substring(0, odata.length - 1);
            }
            url += odata;
        }
        var promise;
        if (typeof (hostUrl) === "undefined" || hostUrl === null) {
            url = webUrl + "_api" + url;
            promise = $http({
                url: url,
                method: "GET",
                headers: { "Accept": "application/json; odata=verbose" }
            });
        }
        else {
            promise = self.Support.SendRequestViaExecutor(url, webUrl, hostUrl, null, "GET");
        }
        var deff = $q.defer();
        promise.then(function (data) { deff.resolve(self.Support.GetJustTheData(data)) }, function (data) { deff.reject(data) });
        return deff.promise;
    }

    this.GetListEnitityType = function GetListEnitityType(listName, webUrl, options, hostUrl) {
        webUrl = self.SanitizeWebUrl(webUrl);

        if (typeof (options) === "string")
            options = { $filter: options };

        var url = "/web/lists/getbytitle('" + listName + "')";
        if (typeof (options) !== "undefined") {
            var odata = "";
            for (var property in options) {
                if (options.hasOwnProperty(property)) {
                    if (property === "LoadPage") {
                        url = options[property];
                        break;
                    }
                    if (odata.length == 0)
                        odata = "?";
                    odata += property + "=" + options[property] + "&";
                }
            }
            if (odata.lastIndexOf("&") == odata.length - 1) {
                odata = odata.substring(0, odata.length - 1);
            }
            url += odata;
        }
        var promise;
        if (typeof (hostUrl) === "undefined" || hostUrl === null) {
            url = webUrl + "_api" + url;
            promise = $http({
                url: url,
                method: "GET",
                headers: { "Accept": "application/json; odata=verbose" }
            });
        }
        else {
            promise = self.Support.SendRequestViaExecutor(url, webUrl, hostUrl, null, "GET");
        }
        var deff = $q.defer();
        promise.then(function (data) { deff.resolve(self.Support.GetJustTheData(data)) }, function (data) { deff.reject(data) });
        return deff.promise;
    }

    this.GetChoiceFieldChoices = function GetChoiceFieldChoices(listName, webUrl, choiceFieldIntName, hostUrl) {
        webUrl = self.SanitizeWebUrl(webUrl);



        var url = "/web/lists/getbytitle('" + listName + "')/Fields?$filter=InternalName eq '" + choiceFieldIntName + "'";

        var promise;
        if (typeof (hostUrl) === "undefined" || hostUrl === null) {
            url = webUrl + "_api" + url;
            promise = $http({
                url: url,
                method: "GET",
                headers: { "Accept": "application/json; odata=verbose" }
            });
        }
        else {
            promise = self.Support.SendRequestViaExecutor(url, webUrl, hostUrl, null, "GET");
        }
        var deff = $q.defer();
        promise.then(function (data) { deff.resolve(self.Support.GetJustTheData(data)) }, function (data) { deff.reject(data) });
        return deff.promise;
    }

    this.GetListItemsByCAML = function GetListItemsByCAML(listName, webUrl, camlQuery, options, hostUrl) {
        webUrl = self.SanitizeWebUrl(webUrl);
        var url = "/web/lists/getbytitle('" + listName + "')/GetItems(query=@v1)?@v1={\"ViewXml\":\"" + camlQuery + "\"}";
        if (typeof (options) !== "undefined") {
            var odata = "";
            for (var property in options) {
                if (options.hasOwnProperty(property)) {
                    if (property === "LoadPage") {
                        url = options[property];
                        break;
                    }
                    if (odata.length == 0)
                        odata = "?";
                    odata += property + "=" + options[property] + "&";
                }
            }
            if (odata.lastIndexOf("&") == odata.length - 1) {
                odata = odata.substring(0, odata.length - 1);
            }
            url += odata;
        }
        var promise;
        if (typeof (hostUrl) === "undefined" || hostUrl === null || hostUrl === "") {
            url = webUrl + "_api" + url;
            promise = $http({
                url: url,
                method: "POST",
                headers: {
                    "Accept": "application/json;odata=verbose",
                    "X-RequestDigest": self.Support.GetCurrentDigestValue(webUrl)
                }
            });
        }
        else {
            promise = self.Support.SendRequestViaExecutor(url, webUrl, hostUrl, null, "POST");
        }
        var deff = $q.defer();
        promise.then(function (data) { deff.resolve(self.Support.GetJustTheData(data)) }, function (data) { deff.reject(data) })
        return deff.promise;
    }

    this.GetListItemByID = function GetListItemByID(itemId,listName, webUrl, options, hostUrl) {
        webUrl = self.SanitizeWebUrl(webUrl);
        var url = "/web/lists/getbytitle('" + listName + "')/items(" + itemId + ")";
        if (typeof (options) !== "undefined") {
            var odata = "";
            for (var property in options) {
                if (options.hasOwnProperty(property)) {
                    if (property === "LoadPage") {
                        url = options[property];
                        break;
                    }
                    if (odata.length == 0)
                        odata = "?";
                    odata += property + "=" + options[property] + "&";
                }
            }
            if (odata.lastIndexOf("&") == odata.length - 1) {
                odata = odata.substring(0, odata.length - 1);
            }
            url += odata;
        }
        var promise;
        if (typeof (hostUrl) === "undefined" || hostUrl === null || hostUrl === "") {
            url = webUrl + "_api" + url;
            promise = $http({
                url: url,
                method: "GET",
                headers: {
                    "Accept": "application/json;odata=verbose",
                    "X-RequestDigest": self.Support.GetCurrentDigestValue(webUrl)
                }
            });
        }
        else {
            promise = self.Support.SendRequestViaExecutor(url, webUrl, hostUrl, null, "GET");
        }
        var deff = $q.defer();
        promise.then(function (data) { deff.resolve(self.Support.GetJustTheData(data)) }, function (data) { deff.reject(data) })
        return deff.promise;
    }
    this.UpdateListItem = function UpdateListItem(itemId, listName, webUrl, updateData, hostUrl) {
        webUrl = self.SanitizeWebUrl(webUrl);
        var itemType = self.GetItemTypeForListName(listName);

        var deff = $q.defer();
        $q.when(self.GetUpdatedDigest(webUrl)).then(function () {
            self.GetItemById(itemId, listName, webUrl, null, hostUrl).then(function (data) {
                updateData.__metadata = { "type": data.__metadata.type };
                var promise;
                if (typeof (hostUrl) === "undefined" || hostUrl === null || hostUrl === "") {
                    promise = $http({
                        url: data.__metadata.uri,
                        method: "POST",
                        data: JSON.stringify(updateData),
                        headers: {
                            "Accept": "application/json;odata=verbose",
                            'Content-Type': 'application/json;odata=verbose',
                            "X-RequestDigest": self.Support.GetCurrentDigestValue(webUrl),
                            "X-HTTP-Method": "MERGE",
                            "If-Match": data.__metadata.etag
                        }
                    });
                }
                else {
                    var url = "/web/lists/getbytitle('" + listName + "')/items(" + itemId + ")";

                    var headers = {
                        "X-HTTP-Method": "MERGE",
                        "If-Match": data.__metadata.etag
                    };
                    promise = self.Support.SendRequestViaExecutor(url, webUrl, hostUrl, updateData, "POST", headers);
                }

                promise.then(function (data1) { deff.resolve(data1) }, function (data1) { deff.reject(data1) });
            });
        });
        return deff.promise;
    }
    this.DeleteListItem = function DeleteListItem(itemId, listName, webUrl, hostUrl) {
        webUrl = self.SanitizeWebUrl(webUrl);
        var deff = $q.defer();
        $q.when(self.GetUpdatedDigest(webUrl)).then(function () {
            self.GetItemById(itemId, listName, webUrl, null, hostUrl).then(function (data) {
                var promise;
                if (typeof (hostUrl) === "undefined" || hostUrl === null || hostUrl === "") {
                    promise = $http({
                        url: data.__metadata.uri,
                        method: "DELETE",
                        headers: {
                            "Accept": "application/json;odata=verbose",
                            "X-Http-Method": "DELETE",
                            "X-RequestDigest": self.Support.GetCurrentDigestValue(webUrl),
                            "If-Match": data.__metadata.etag
                        }
                    });
                }
                else {
                    var headers = {
                        "X-HTTP-Method": "DELETE",
                        "If-Match": data.__metadata.etag
                    };
                    var url = "/web/lists/getbytitle('" + listName + "')/items(" + itemId + ")";
                    promise = self.Support.SendRequestViaExecutor(url, webUrl, hostUrl, null, "DELETE", headers);
                }

                promise.then(function (data1) { deff.resolve(self.Support.GetJustTheData(data1)) }, function (data1) { deff.reject(data1) });

            });
        });
        return deff.promise;
    }
    this.GetGroup = function GetGroup(groupName, includeMembers, webUrl, hostUrl) {
        webUrl = self.SanitizeWebUrl(webUrl);

        var url = "/web/sitegroups?$filter=(Title%20eq%20%27" + groupName + "%27)";
        if (includeMembers)
            url = url + "&$expand=Users";
        var deff = $q.defer();
        var promise;
        if (typeof (hostUrl) === "undefined" || hostUrl === null || hostUrl === "") {
            url = webUrl + "_api" + url;
            promise = $http({
                url: url,
                method: "GET",
                headers: { "Accept": "application/json; odata=verbose" }
            });
        }
        else {
            promise = self.Support.SendRequestViaExecutor(url, webUrl, hostUrl, null, "GET");
        }
        promise.then(function (data1) { deff.resolve(self.Support.GetJustTheData(data1)) }, function (data1) { deff.reject(data1) });
        return deff.promise;
    }
    this.IsFolderExist = function IsFolderExist(relativeUrl, webUrl, hostUrl) {
        webUrl = self.SanitizeWebUrl(webUrl);

        var url = "/web/GetFolderByServerRelativeUrl('"+relativeUrl+"')";
        
        var deff = $q.defer();
        var promise;
        if (typeof (hostUrl) === "undefined" || hostUrl === null || hostUrl === "") {
            url = webUrl + "_api" + url;
            promise = $http({
                url: url,
                method: "GET",
                headers: { "Accept": "application/json; odata=verbose" }
            });
        }
        else {
            promise = self.Support.SendRequestViaExecutor(relativeUrl, webUrl, hostUrl, null, "GET");
        }
        promise.then(function (data1) { deff.resolve(self.Support.GetJustTheData(data1)) }, function (data1) { deff.reject(data1) });
        return deff.promise;
    }

    this.GetSiteUsers = function GetSiteUsers(webUrl, options, hostUrl) {
        webUrl = self.SanitizeWebUrl(webUrl);

        var url = "/web/SiteUsers";
        if (typeof (options) !== "undefined") {
            var odata = "";
            for (var property in options) {
                if (options.hasOwnProperty(property)) {
                    if (property === "LoadPage") {
                        url = options[property];
                        break;
                    }
                    if (odata.length == 0)
                        odata = "?";
                    odata += property + "=" + options[property] + "&";
                }
            }
            if (odata.lastIndexOf("&") == odata.length - 1) {
                odata = odata.substring(0, odata.length - 1);
            }
            url += odata;
        }
        var deff = $q.defer();
        var promise;
        if (typeof (hostUrl) === "undefined" || hostUrl === null || hostUrl === "") {
            url = webUrl + "_api" + url;
            promise = $http({
                url: url,
                method: "GET",
                headers: { "Accept": "application/json; odata=verbose" }
            });
        }
        else {
            promise = self.Support.SendRequestViaExecutor(url, webUrl, hostUrl, null, "GET");
        }

        promise.then(function (data1) { deff.resolve(self.Support.GetJustTheData(data1)) }, function (data1) { deff.reject(data1) });
        return deff.promise;
    }
    this.GetUserById = function GetUserById(userId, webUrl, hostUrl) {
        webUrl = self.SanitizeWebUrl(webUrl);
        var url = "/Web/GetUserById(" + userId + ")";
        var deff = $q.defer();
        var promise;
        if (typeof (hostUrl) === "undefined" || hostUrl === null || hostUrl === "") {
            url = webUrl + "_api" + url;
            promise = $http({
                url: url,
                method: "GET",
                headers: { "Accept": "application/json; odata=verbose" }
            });
        }
        else {
            promise = self.Support.SendRequestViaExecutor(url, webUrl, hostUrl, null, "GET");
        }
        promise.then(function (data1) { deff.resolve(self.Support.GetJustTheData(data1)) }, function (data1) { deff.reject(data1) });
        return deff.promise;

    }
    this.AddUsertoGroup = function AddUsertoGroup(groupId, loginName, webUrl, hostUrl) {
        webUrl = self.SanitizeWebUrl(webUrl);
        var deff = $q.defer();
        $q.when(self.GetUpdatedDigest(webUrl)).then(function () {
            var item = { LoginName: loginName };
            item["__metadata"] = { "type": "SP.User" };
            webUrl = self.SanitizeWebUrl(webUrl);

            var url = "/web/sitegroups(" + groupId + ")/users";

            var promise;
            if (typeof (hostUrl) === "undefined" || hostUrl === null || hostUrl === "") {
                url = webUrl + "_api" + url;
                promise = $http({
                    url: url,
                    method: "POST",
                    data: JSON.stringify(item),
                    headers: {
                        "Accept": "application/json;odata=verbose",
                        'Content-Type': 'application/json;odata=verbose',
                        "X-RequestDigest": self.Support.GetCurrentDigestValue(webUrl)
                    }
                });
            }
            else {
                promise = self.Support.SendRequestViaExecutor(url, webUrl, hostUrl, null, "POST");
            }

            promise.then(function (data1) { deff.resolve(self.Support.GetJustTheData(data1)) }, function (data1) { deff.reject(data1) });
        });
        return deff.promise;
    }




    this.GetDetailsWithGroupForCurrentUser = function GetDetailsWithGroupForCurrentUser(webUrl) {
        webUrl = self.SanitizeWebUrl(webUrl);

        url = "/web/currentuser?$expand=groups";
        var deff = $q.defer();
        $q.when(self.GetUpdatedDigest(webUrl)).then(function () {
            var promise;

            promise = $http({
                url: webUrl + "_api" + url,
                method: "GET",
                transformRequest: [],
                headers: {
                    "Accept": "application/json; odata=verbose",
                    "X-RequestDigest": self.Support.GetCurrentDigestValue(webUrl),

                }
            });
            promise.then(function (data1) { deff.resolve(self.Support.GetJustTheData(data1)) }, function (data1) { deff.reject(data1) });
        });
        return deff.promise;
    }

    this.GetUserId = function getUserId(loginName) {
        var deffered = $q.defer();
        var context = new SP.ClientContext.get_current();
        var user = context.get_web().ensureUser(loginName);
        context.load(user);
        context.executeQueryAsync(
             Function.createDelegate(user, function () { deffered.resolve(user); }),
             Function.createDelegate(user, function () { deffered.reject(user, args); })
        );
        return deffered.promise;
    }
    this.CreateSubSite = function CreateSubSite(options, webUrl, hostUrl) {
        webUrl = self.SanitizeWebUrl(webUrl);
        var createData = {
            parameters: {
                '__metadata': {
                    'type': 'SP.WebInfoCreationInformation'
                },
                Url: options.siteUrl,
                Title: options.siteName,
                Description: options.siteDescription,
                Language: 1033,
                WebTemplate: options.siteTemplate,
                UseUniquePermissions: options.uniquePermissions
                //CustomMasterUrl: options.MasterUrl,
                //MasterUrl: options.MasterUrl,
                //EnableMinimalDownload: options.MinimalDownload
            }
        };
        var deffered = $q.defer();
        $q.when(self.GetUpdatedDigest(webUrl)).then(function () {

            // Once we have the form digest value, we can create the subsite
            var url = "/web/webinfos/add";

            var promise;
            if (typeof (hostUrl) === "undefined" || hostUrl === null || hostUrl === "") {
                url = webUrl + "_api" + url;
                promise = $http({
                    url: url,
                    type: "POST",
                    headers: {
                        "accept": "application/json;odata=verbose",
                        "content-type": "application/json;odata=verbose",
                        "X-RequestDigest": self.Support.GetCurrentDigestValue(webUrl)
                    },
                    data: JSON.stringify(createData)
                });
            }
            else {
                promise = self.Support.SendRequestViaExecutor(url, webUrl, hostUrl, createData, "POST");
            }

            promise.then(function (data) {
                deffered.resolve(self.Support.GetJustTheData(data));
            });
        });
        return deffered.promise;
    }
    this.GetWebData = function GetWebData(webUrl, hostUrl) {
        webUrl = self.SanitizeWebUrl(webUrl);
        var url = webUrl + "_api/web";

        var deff = $q.defer();
        var promise;
        if (typeof (hostUrl) === "undefined" || hostUrl === null || hostUrl === "") {
            promise = $http({
                url: url,
                method: "GET",
                headers: { "Accept": "application/json; odata=verbose" }
            });
        }
        else {
            promise = self.Support.SendRequestViaExecutor(url, webUrl, hostUrl, null, "GET");
        }
        promise.then(function (data1) { deff.resolve(self.Support.GetJustTheData(data1)) }, function (data1) { deff.reject(data1) });
        return deff.promise;
    }
    this.UpdateWebData = function UpdateWebData(webUrl, updateData, hostUrl) {
        webUrl = self.SanitizeWebUrl(webUrl);

        var deff = $q.defer();
        $q.when(self.GetUpdatedDigest(webUrl)).then(function () {
            updateData.__metadata = { "type": "SP.Web" };
            self.GetWebData(webUrl, hostUrl).then(function (data) {
                var promise;
                if (typeof (hostUrl) === "undefined" || hostUrl === null || hostUrl === "") {
                    promise = $http({
                        url: data.__metadata.uri,
                        type: "POST",
                        data: JSON.stringify(updateData),
                        headers: {
                            "Accept": "application/json;odata=verbose",
                            'Content-Type': 'application/json;odata=verbose',
                            "X-RequestDigest": self.Support.GetCurrentDigestValue(webUrl),
                            "X-HTTP-Method": "MERGE",
                            "If-Match": data.__metadata.etag
                        }
                    });
                }
                else {
                    var headers = {
                        "X-HTTP-Method": "DELETE",
                        "If-Match": data.__metadata.etag
                    };
                    promise = self.Support.SendRequestViaExecutor(data.__metadata.uri, webUrl, hostUrl, updateData, "POST", headers);
                }
                promise.then(function (data1) { deff.resolve(self.Support.GetJustTheData(data1)) }, function (data1) { deff.reject(data1) });
            });
        });
        return deff.promise;
    }

    this.AddFileToLibrary = function AddFileToLibrary(listDisplayName, webUrl, fileName, file, folderName) {
        webUrl = self.SanitizeWebUrl(webUrl);
        var url;
        if (folderName == null || folderName == undefined) {
            url = webUrl + "_api/web/lists/getByTitle(@TargetLibrary)/RootFolder/Files/add(url=@TargetFileName,overwrite='true')?@TargetLibrary='" + listDisplayName + "'&@TargetFileName='" + fileName + "'";
        }
        else {
            var folders = folderName.split("/");
            url = webUrl + "_api/web/lists/getByTitle(@TargetLibrary)/RootFolder/";
            angular.forEach(folders, function (value, key) {
                url = url + "folders('" + value + "')/";
            });
            url = url + "Files/add(url=@TargetFileName,overwrite='true')?@TargetLibrary='" + listDisplayName + "'&@TargetFileName='" + fileName + "'";
            //url = webUrl + "_api/web/GetFolderByServerRelativeUrl('sites/metlife/controversy/" + listDisplayName + "/" + folderName + "')/Files/add(url=@TargetFileName,overwrite='true')?" + "'&@TargetFileName='" + fileName + "'";
        }
        var deff = $q.defer();
        $q.when(self.GetUpdatedDigest(webUrl)).then(function () {
            var promise;

            promise = $http({
                url: url,
                method: "POST",
                transformRequest: [],
                data: file,
                headers: {
                    "Accept": "application/json; odata=verbose",
                    "X-RequestDigest": self.Support.GetCurrentDigestValue(webUrl)
                }
            });
            promise.then(function (data1) { deff.resolve(self.Support.GetJustTheData(data1)) }, function (data1) { deff.reject(data1) });
        });
        return deff.promise;
    }

    this.AddFoldersToLibrary = function AddFoldersToLibrary(listInternalName, webUrl, folderName) {
        webUrl = self.SanitizeWebUrl(webUrl);
        var webUrlSplitObj = webUrl.split("/");
        var relativeUrlOfSite = webUrl.replace(webUrlSplitObj[0] + "//" + webUrlSplitObj[2], "");
        var postData = JSON.stringify({
            '__metadata': { 'type': 'SP.Folder' },
            'ServerRelativeUrl': relativeUrlOfSite + listInternalName + '/' + folderName
        });

        var url = "/web/Folders/";


        var deff = $q.defer();
        $q.when(self.GetUpdatedDigest(webUrl)).then(function () {
            var promise;
            if (typeof (hostUrl) === "undefined" || hostUrl === null || hostUrl === "") {
                promise = $http({
                    url: webUrl + "_api" + url,
                    method: "POST",
                    data: postData,
                    headers: {
                        "Accept": "application/json;odata=verbose",
                        'Content-Type': 'application/json;odata=verbose',
                        "X-RequestDigest": self.Support.GetCurrentDigestValue(webUrl)
                    }
                });
            }
            else {
                promise = self.Support.SendRequestViaExecutor(url, webUrl, hostUrl, item, "POST");
            }
            promise.then(function (data) { deff.resolve(self.Support.GetJustTheData(data)) }, function (data) { deff.reject(data) });
        });
        return deff.promise;
    }

    this.CopyFileBetweenFolders = function CopyFileBetweenFolders(webUrl, sourceFileUrl, targetFileUrl) {
        webUrl = self.SanitizeWebUrl(webUrl);
        var url;
        url = webUrl + "/_api/web/getfilebyserverrelativeurl('" + sourceFileUrl + "')/copyto(strnewurl='" + targetFileUrl + "',boverwrite=false)";
        //     var endpointUrl = _spPageContextInfo.webAbsoluteUrl + "/_api/web/getfilebyserverrelativeurl('" + sourceFileUrl + "')/copyto(strnewurl='" + targetFileUrl + "',boverwrite=false)";
        var deff = $q.defer();
        $q.when(self.GetUpdatedDigest(webUrl)).then(function () {
            var promise;

            promise = $http({
                url: url,
                method: "POST",
                transformRequest: [],

                headers: {
                    "Accept": "application/json; odata=verbose",
                    "X-RequestDigest": self.Support.GetCurrentDigestValue(webUrl)
                }
            });
            promise.then(function (data1) { deff.resolve(self.Support.GetJustTheData(data1)) }, function (data1) { deff.reject(data1) });
        });
        return deff.promise;
    }


    this.GetFile = function GetFile(listInternalName, webUrl, fileName, folderName) {
        webUrl = self.SanitizeWebUrl(webUrl);
        var webUrlSplitObj = webUrl.split("/");
        var relativeUrlOfSite = webUrl.replace(webUrlSplitObj[0] + "//" + webUrlSplitObj[2], "");
        url = "/web/GetFileByServerRelativeUrl('" + relativeUrlOfSite + listInternalName + '/' + folderName + "/" + fileName + "')";
        var deff = $q.defer();
        $q.when(self.GetUpdatedDigest(webUrl)).then(function () {
            var promise;

            promise = $http({
                url: webUrl + "_api" + url,
                method: "GET",
                transformRequest: [],
                headers: {
                    "Accept": "application/json; odata=verbose",
                    "X-RequestDigest": self.Support.GetCurrentDigestValue(webUrl),

                }
            });
            promise.then(function (data1) { deff.resolve(self.Support.GetJustTheData(data1)) }, function (data1) { deff.reject(data1) });
        });
        return deff.promise;
    }

    this.DeleteFileFromLibrary = function DeleteFileFromLibrary(listInternalName, webUrl, fileName, folderName) {
        var deff = $q.defer();
        $q.when(self.GetUpdatedDigest(webUrl)).then(function () {
            webUrl = self.SanitizeWebUrl(webUrl);
            var webUrlSplitObj = webUrl.split("/");
            var relativeUrlOfSite = webUrl.replace(webUrlSplitObj[0] + "//" + webUrlSplitObj[2], "");

            url = "/web/GetFileByServerRelativeUrl('" + relativeUrlOfSite + listInternalName + '/' + folderName + "/" + fileName + "')";




            var promise;

            promise = $http({
                url: webUrl + "_api" + url,
                method: "DELETE",
                transformRequest: [],
                headers: {
                    "Accept": "application/json; odata=verbose",
                    "X-RequestDigest": self.Support.GetCurrentDigestValue(webUrl),
                    "IF-MATCH": "*",
                    "X-HTTP-Method": "DELETE",
                    "async": false
                }

            });
            promise.then(function (data1) { deff.resolve(self.Support.GetJustTheData(data1)) }, function (data1) { deff.reject(data1) });

        });
        return deff.promise;
    }



    this.GetFilesFromFolder = function AddFoldersToLibrary(listInternalName, webUrl, folderName) {
        webUrl = self.SanitizeWebUrl(webUrl);



        var url = "/web/GetFolderByServerRelativeUrl('" + listInternalName + "/" + folderName + "')/files";


        var deff = $q.defer();
        $q.when(self.GetUpdatedDigest(webUrl)).then(function () {
            var promise;
            if (typeof (hostUrl) === "undefined" || hostUrl === null || hostUrl === "") {
                promise = $http({
                    url: webUrl + "_api" + url,
                    method: "POST",

                    headers: {
                        "Accept": "application/json;odata=verbose",
                        'Content-Type': 'application/json;odata=verbose',
                        "X-RequestDigest": self.Support.GetCurrentDigestValue(webUrl)
                    }
                });
            }
            else {
                promise = self.Support.SendRequestViaExecutor(url, webUrl, hostUrl, item, "POST");
            }
            promise.then(function (data) { deff.resolve(self.Support.GetJustTheData(data)) }, function (data) { deff.reject(data) });
        });
        return deff.promise;
    }

    this.Search = {
        Get: function Get(webUrl, options) {
            webUrl = self.SanitizeWebUrl(webUrl);
            var url = webUrl + "_api/search/query";

            var params = "";
            for (var property in options) {
                if (options.hasOwnProperty(property)) {
                    if (params.length == 0)
                        params = "?";
                    params += property + "=";
                    if (typeof (options[property]) === "number" || typeof (options[property]) === "boolean") {
                        params += "" + options[property];
                    }
                    else {
                        params += "'" + options[property] + "'";
                    }
                    params += "&";
                }
            }
            if (params.lastIndexOf("&") == params.length - 1) {
                params = params.substring(0, params.length - 1);
            }
            url += params;

            var deff = $q.defer();
            var promise = $http({
                url: url,
                method: "GET",
                headers: { "Accept": "application/json; odata=verbose" }
            });
            promise.then(function (data1) { deff.resolve(self.Search.GetReturnFromResponse(data1)) }, function (data1) { deff.reject(data1) });
            return deff.promise;
        },
        Post: function Post(webUrl, options) {

        },
        GetReturnFromResponse: function GetReturnFromResponse(data) {
            var obj = {
                ElapsedTime: data.data.d.query.ElapsedTime,
                PrimaryQueryResult: {
                    RefinementResults: self.Search.GetArrayFromResultList(data.data.d.query.PrimaryQueryResult.RefinementResults),
                    RelevantResults: self.Search.GetArrayFromResultList(data.data.d.query.PrimaryQueryResult.RelevantResults),
                    SpecialTermResults: self.Search.GetArrayFromResultList(data.data.d.query.PrimaryQueryResult.SpecialTermResults)
                },
                SpellingSuggestion: data.data.d.query.SpellingSuggestion
            };

            return obj;
        },
        GetArrayFromResultList: function GetArrayFromResultList(res) {
            if (res === null)
                return null;
            var ret = { Results: [], RowCount: res.RowCount };
            for (var i = 0; i < res.Table.Rows.results.length; i++) {
                var obj = res.Table.Rows.results[i];
                var retObj = {};
                for (var j = 0; j < obj.Cells.results.length; j++) {
                    switch (obj.Cells.results[j].ValueType) {
                        case "Edm.Double":
                        case "Edm.Int64":
                            retObj[obj.Cells.results[j].Key] = Number(obj.Cells.results[j].Value);
                            break;
                        case "Edm.DateTime":
                            retObj[obj.Cells.results[j].Key] = new Date(obj.Cells.results[j].Value);
                            break;
                        case "Edm.Boolean":
                            retObj[obj.Cells.results[j].Key] = obj.Cells.results[j].Value === "true";
                            break;
                        default:
                            retObj[obj.Cells.results[j].Key] = obj.Cells.results[j].Value;
                            break;
                    }
                }
                ret.Results.push(retObj);
            }
            return ret;
        }
    };



    this.GetDetailsForCurrentUser = function GetDetailsForCurrentUser(webUrl) {
        webUrl = self.SanitizeWebUrl(webUrl);

        url = "/web/currentuser?$expand=groups";
        var deff = $q.defer();
        $q.when(self.GetUpdatedDigest(webUrl)).then(function () {
            var promise;

            promise = $http({
                url: webUrl + "_api" + url,
                method: "GET",
                transformRequest: [],
                headers: {
                    "Accept": "application/json; odata=verbose",
                    "X-RequestDigest": self.Support.GetCurrentDigestValue(webUrl),

                }
            });
            promise.then(function (data1) { deff.resolve(self.Support.GetJustTheData(data1)) }, function (data1) { deff.reject(data1) });
        });
        return deff.promise;
    }


    this.GetAllGroupsForAUser = function GetAllGroupsForAUser(userLoginName, webUrl) {
        webUrl = self.SanitizeWebUrl(webUrl);
        userLoginName = userLoginName.replace("#", "%23");
        url = "/web/siteusers(@loginName)/groups?@loginName='" + userLoginName + "'";
        var deff = $q.defer();
        $q.when(self.GetUpdatedDigest(webUrl)).then(function () {
            var promise;

            promise = $http({
                url: webUrl + "_api" + url,
                method: "GET",
                transformRequest: [],
                headers: {
                    "Accept": "application/json; odata=verbose",
                    "X-RequestDigest": self.Support.GetCurrentDigestValue(webUrl),

                }
            });
            promise.then(function (data1) { deff.resolve(self.Support.GetJustTheData(data1)) }, function (data1) { deff.reject(data1) });
        });
        return deff.promise;
    }





    this.Profile = {
        GetCurrentUser: function GetCurrentUser(webUrl, options, hostUrl) {
            webUrl = self.SanitizeWebUrl(webUrl);
            var url = "/SP.UserProfiles.PeopleManager/GetMyProperties";
            if (typeof (options) !== "undefined") {
                var odata = "";
                for (var property in options) {
                    if (options.hasOwnProperty(property)) {
                        if (property === "LoadPage") {
                            url = options[property];
                            break;
                        }
                        if (odata.length == 0)
                            odata = "?";
                        odata += property + "=" + options[property] + "&";
                    }
                }
                if (odata.lastIndexOf("&") == odata.length - 1) {
                    odata = odata.substring(0, odata.length - 1);
                }
                url += odata;
            }
            var promise;
            if (typeof (hostUrl) === "undefined" || hostUrl === null || hostUrl === "") {
                url = webUrl + "_api" + url;
                promise = $http({
                    url: url,
                    method: "GET",
                    headers: { "Accept": "application/json; odata=verbose" }
                });
            }
            else {
                promise = self.Support.SendRequestViaExecutor(url, webUrl, hostUrl, null, "GET");
            }
            var deff = $q.defer();
            promise.then(function (data) { deff.resolve(self.Support.GetJustTheData(data)) }, function (data) { deff.reject(data) });
            return deff.promise;
        },
        GetForUser: function GetForUser(webUrl, userName, options, hostUrl) {
            webUrl = self.SanitizeWebUrl(webUrl);
            var url = "/SP.UserProfiles.PeopleManager/GetPropertiesFor(accountName=@v)?@v='" + userName + "'";
            if (typeof (options) !== "undefined") {
                var odata = "";
                for (var property in options) {
                    if (options.hasOwnProperty(property)) {
                        if (property === "LoadPage") {
                            url = options[property];
                            break;
                        }
                        if (odata.length == 0)
                            odata = "?";
                        odata += property + "=" + options[property] + "&";
                    }
                }
                if (odata.lastIndexOf("&") == odata.length - 1) {
                    odata = odata.substring(0, odata.length - 1);
                }
                url += odata;
            }
            var promise;
            if (typeof (hostUrl) === "undefined" || hostUrl === null || hostUrl === "") {
                url = webUrl + "_api" + url;
                promise = $http({
                    url: url,
                    method: "GET",
                    headers: { "Accept": "application/json; odata=verbose" }
                });
            }
            else {
                promise = self.Support.SendRequestViaExecutor(url, webUrl, hostUrl, null, "GET");
            }
            var deff = $q.defer();
            promise.then(function (data) { deff.resolve(self.Support.GetJustTheData(data)) }, function (data) { deff.reject(data) });
            return deff.promise;
        }
    };
    this.getDeferred = function (obj, query, paged) {
        var deferred = $q.defer();
        if (obj.__deferred) {
            $http({
                method: "GET",
                url: obj.__deferred.uri + (query || "")
            }).success(function (data, status, headers, config) {
                if (paged) deferred.resolve(data.d);
                else if (data.d.results) deferred.resolve(data.d.results);
                else deferred.resolve(data.d);
            }).error(function (data, status, headers, config) {
                deferred.reject();
            });
        } else deferred.resolve(obj);
        return deferred.promise;
    };
    this.lists = {};
    this.list = function (id, webUrl) {

        var list = this;
        var webUrl = self.SanitizeWebUrl(webUrl);
        if (id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) this.url = webUrl + "/_api/web/lists(guid'" + id + "')";
        else this.url = webUrl + "/_api/web/lists/GetByTitle('" + id + "')";

        this.id = id;

        this.getList = function () {
            var deferred = $q.defer();
            if (self.lists[list.id]) deferred.resolve(self.lists[list.id]);
            else {
                self.lists[list.id] = deferred.promise;
                url = webUrl + "_api" + list.url;
                var promise = $http({
                    url: url,
                    method: "GET",
                    headers: { "Accept": "application/json; odata=verbose" }
                });


                var deff = $q.defer();
                promise.then(function (data) {
                    var list = data.d;
                    if (list.Fields.__deferred) {
                        self.getDeferred(list.Fields).then(function (response) {
                            list.Fields = _.indexBy(response, "InternalName");
                            self.lists[list.Title] = list;
                            self.lists[list.Id] = list;
                            deferred.resolve(self.Support.GetJustTheData(list));
                        });
                    } else {
                        self.lists[list.Title] = list;
                        self.lists[list.Id] = list;
                        deferred.resolve(self.Support.GetJustTheData(list));
                    }
                }, function (data) { deff.reject(data) });
                return deff.promise;
            }
        };







        // fields method
        this.getFields = function (params) {
            var deferred = $q.defer();
            if (params) {
                var filters = [];
                if (params.select) filters.push("$select=" + params.select);
                if (params.expand) filters.push("$expand=" + params.expand);
                if (params.filter) filters.push("$filter=" + params.filter);
                if (params.top) filters.push("$top=" + params.top);
                var query = "?" + filters.join("&");
            }
            list.getList().then(function (list) {
                self.getDeferred(list.Fields, query).then(function (fields) {
                    deferred.resolve(_.indexBy(fields, "InternalName"));
                });
            });
            return deferred.promise;
        };

        // content types method
        this.getContentTypes = function (id) {
            var deferred = $q.defer();
            if (id) var query = "('" + id + "')";
            list.getList().then(function (list) {
                self.getDeferred(list.ContentTypes, query).then(function (contentTypes) {
                    deferred.resolve(contentTypes);
                });
            });
            return deferred.promise;
        };



        return this;
    };


    this.getListFields = function getListFields(listName, webUrl, hostUrl) {
        webUrl = self.SanitizeWebUrl(webUrl);



        var url = "/web/lists/getbytitle('" + listName + "')/Fields";

        var promise;
        if (typeof (hostUrl) === "undefined" || hostUrl === null) {
            url = webUrl + "_api" + url;
            promise = $http({
                url: url,
                method: "GET",
                headers: { "Accept": "application/json; odata=verbose" }
            });
        }
        else {
            promise = self.Support.SendRequestViaExecutor(url, webUrl, hostUrl, null, "GET");
        }
        var deff = $q.defer();
        promise.then(function (data) {
            deff.resolve(self.Support.GetJustTheData(data))
        }, function (data) {
            deff.reject(data)
        });
        return deff.promise;
    }

}]);
angularSP.service('AngularSPCSOM', ['$q', function ($q) {
    var self = this;

    this.GetItemTypeForListName = function GetItemTypeForListName(name) {
        return "SP.Data." + name.charAt(0).toUpperCase() + name.split(" ").join("").slice(1) + "ListItem";
    }
    this.SanitizeWebUrl = function SanitizeWebUrl(url) {
        if (typeof (url) == "undefined" || url == null || url == "")
            url = _spPageContextInfo.siteAbsoluteUrl;
        return url;
    }
    this.CreateListItem = function CreateListItem(listName, webUrl, item) {
        webUrl = self.SanitizeWebUrl(webUrl);

        var clientContext = new SP.ClientContext(webUrl);
        var list = clientContext.get_web().get_lists().getByTitle(listName);

        var createInfo = new SP.ListItemCreationInformation();
        var listItem = list.addItem(createInfo);
        for (var name in item) {
            listItem.set_item(name, item[name]);
        }
        listItem.update();

        var ctx = {
            Context: clientContext,
            List: list,
            ListItem: listItem
        };

        clientContext.load(ctx.ListItem);
        var deff = $q.defer();
        clientContext.executeQueryAsync(
            Function.createDelegate(ctx,
                function () {
                    deff.resolve(ctx.ListItem.get_fieldValues());
                }),
            Function.createDelegate(ctx,
                function (sender, args) {
                    deff.reject(args);
                }));
        return deff.promise;
    }
    this.CreateDocumentSet = function CreateDocumentSet(webUrl, listTitle, folderName, docSetName, docSetContentTypeID) {
        webUrl = self.SanitizeWebUrl(webUrl);
        var ctx = new SP.ClientContext(webUrl);
        var web = ctx.get_web();
        var list = web.get_lists().getByTitle(listTitle);
        ctx.load(list);

        var parentFolder = list.get_rootFolder();

        ctx.load(parentFolder);



        // var docSetContentTypeID = "0x0120D520";
        var docSetContentType = ctx.get_site().get_rootWeb().get_contentTypes().getById(docSetContentTypeID);
        ctx.load(docSetContentType);

        var deff = $q.defer();

        ctx.executeQueryAsync(function () {
            var folder = web.getFolderByServerRelativeUrl(parentFolder.get_serverRelativeUrl() + '/' + folderName);
            SP.DocumentSet.DocumentSet.create(ctx, folder, docSetName, docSetContentType.get_id());
            var docSetFolder = web.getFolderByServerRelativeUrl(parentFolder.get_serverRelativeUrl() + '/' + folderName + '/' + docSetName);
            var docSetFolderItem = docSetFolder.get_listItemAllFields();
            ctx.load(docSetFolderItem);

            ctx.executeQueryAsync(
         Function.createDelegate(ctx,
              function () {
                  deff.resolve(docSetFolderItem.get_fieldValues());
              }),
          Function.createDelegate(ctx,
              function (sender, args) {
                  deff.reject(args);
              }));
        }
     );
        return deff.promise;

    }




    this.GetItemById = function GetItemById(itemId, listName, webUrl) {
        webUrl = self.SanitizeWebUrl(webUrl);

        var clientContext = new SP.ClientContext(webUrl);
        var targetList = clientContext.get_web().get_lists().getByTitle(listName);
        var targetListItem = targetList.getItemById(itemId);
        clientContext.load(targetListItem);
        var deff = $q.defer();
        clientContext.executeQueryAsync(
            function () {
                deff.resolve(targetListItem.get_fieldValues());
            },
            function (sender, args) {
                deff.reject(args);
            });

        return deff.promise;
    }
    this.GetArrayFromJSOMEnumerator = function (enumObj) {
        var Enumerator = enumObj.getEnumerator();
        var ret = [];

        while (Enumerator.moveNext()) {
            var obj = Enumerator.get_current();
            ret.push(obj.get_fieldValues());
        }
        return ret;
    }
    this.GetListItems = function GetListItems(listName, webUrl, camlquery) {
        webUrl = self.SanitizeWebUrl(webUrl);

        var clientContext = new SP.ClientContext(webUrl);
        var oList = clientContext.get_web().get_lists().getByTitle(listName);

        var camlQuery = new SP.CamlQuery();
        if (typeof (camlquery) !== "undefined") {
            camlQuery.set_viewXml(camlquery);
        }
        var ctx = {
            Context: clientContext,
            List: oList
        };
        ctx.collListItem = oList.getItems(camlQuery);

        var deff = $q.defer();
        clientContext.load(ctx.collListItem);
        clientContext.executeQueryAsync(
            Function.createDelegate(ctx,
                function () {
                    var ret = self.GetArrayFromJSOMEnumerator(ctx.collListItem);
                    deff.resolve(ret);
                }),
            Function.createDelegate(this,
                function (sender, args) {
                    deff.reject(args);
                })
        );
        return deff.promise;
    }
    this.UpdateListItem = function UpdateListItem(itemId, listName, webUrl, item) {
        webUrl = self.SanitizeWebUrl(webUrl);

        var clientContext = new SP.ClientContext(webUrl);
        var oList = clientContext.get_web().get_lists().getByTitle(listName);

        var listItem = oList.getItemById(itemId);
        for (var name in item) {
            listItem.set_item(name, item[name]);
        }
        listItem.update();

        var ctx = {
            Context: clientContext,
            List: oList,
            ListItem: listItem
        };

        var deff = $q.defer();
        clientContext.executeQueryAsync(
            Function.createDelegate(ctx,
                function () {
                    deff.resolve(ctx.ListItem.get_fieldValues());
                }),
            Function.createDelegate(ctx,
                function (sender, args) {
                    deff.reject(args);
                })
        );

        return deff.promise;
    }
    this.DeleteListItem = function DeleteListItem(itemId, listName, webUrl) {
        webUrl = self.SanitizeWebUrl(webUrl);

        var clientContext = new SP.ClientContext(webUrl);
        var list = clientContext.get_web().get_lists().getByTitle(listName);
        var oListItem = list.getItemById(itemId);
        oListItem.deleteObject();

        var deff = $q.defer();
        clientContext.executeQueryAsync(
            function () {
                deff.resolve();
            },
            function (sender, args) {
                deff.reject(args);
            }
        );
        return deff.promise;
    }
    this.GetGroup = function GetGroup(groupName, includeMembers, webUrl) {
        webUrl = self.SanitizeWebUrl(webUrl);

        throw {
            name: "GetGroup",
            level: "Not Implemented",
            message: "Not Implemented",
            htmlMessage: "Not Implemented",
            toString: function () { return this.name + ": " + this.message; }
        };

        var url = webUrl + "_api/web/sitegroups?$filter=(Title%20eq%20%27" + groupName + "%27)";
        if (includeMembers)
            url = url + "&$expand=Users";
        var promise = $http({
            url: url,
            method: "GET",
            headers: { "Accept": "application/json; odata=verbose" }
        });

        return promise;
    }
    this.GetSiteUsers = function GetSiteUsers(webUrl) {
        webUrl = self.SanitizeWebUrl(webUrl);
        throw {
            name: "GetSiteUsers",
            level: "Not Implemented",
            message: "Not Implemented",
            htmlMessage: "Not Implemented",
            toString: function () { return this.name + ": " + this.message; }
        };

        var url = webUrl + "_api/web/SiteUsers";
        var promise = $http({
            url: url,
            method: "GET",
            headers: { "Accept": "application/json; odata=verbose" }
        });

        return promise;
    }
    this.GetUserById = function GetUserById(userId, webUrl) {
        webUrl = self.SanitizeWebUrl(webUrl);
        throw {
            name: "GetUserById",
            level: "Not Implemented",
            message: "Not Implemented",
            htmlMessage: "Not Implemented",
            toString: function () { return this.name + ": " + this.message; }
        };
        var url = webUrl + "_api/Web/GetUserById(" + userId + ")";
        var promise = $http({
            url: url,
            method: "GET",
            headers: { "Accept": "application/json; odata=verbose" }
        });
        return promise;

    }
    this.AddUsertoGroup = function AddUsertoGroup(groupId, loginName, webUrl) {
        webUrl = self.SanitizeWebUrl(webUrl);
        throw {
            name: "AddUsertoGroup",
            level: "Not Implemented",
            message: "Not Implemented",
            htmlMessage: "Not Implemented",
            toString: function () { return this.name + ": " + this.message; }
        };
        var item = { LoginName: loginName };
        item["__metadata"] = { "type": "SP.User" };
        webUrl = self.SanitizeWebUrl(webUrl);
        var promise = $http({
            url: webUrl + "_api/web/sitegroups(" + groupId + ")/users",
            type: "POST",
            contentType: "application/json;odata=verbose",
            data: JSON.stringify(item),
            headers: {
                "Accept": "application/json;odata=verbose",
                "X-RequestDigest": $("#__REQUESTDIGEST").val()
            }
        });
        return promise;
    }
    this.GetUserId = function GetUserId(loginName, webUrl) {
        webUrl = self.SanitizeWebUrl(webUrl);
        var deff = $q.defer();
        var context = new SP.ClientContext(webUrl);
        var user = context.get_web().ensureUser(loginName);
        context.load(user);
        context.executeQueryAsync(
             function () { deff.resolve(user); },
             function (sender, args) { deff.reject(user, args); }
        );
        return deff.promise;
    }
    this.CreateSubSite = function CreateSubSite(options, webUrl) {
        webUrl = self.SanitizeWebUrl(webUrl);
        throw {
            name: "CreateSubSite",
            level: "Not Implemented",
            message: "Not Implemented",
            htmlMessage: "Not Implemented",
            toString: function () { return this.name + ": " + this.message; }
        };
        var createData = {
            parameters: {
                '__metadata': {
                    'type': 'SP.WebInfoCreationInformation'
                },
                Url: options.siteUrl,
                Title: options.siteName,
                Description: options.siteDescription,
                Language: 1033,
                WebTemplate: options.siteTemplate,
                UseUniquePermissions: options.uniquePermissions
                //CustomMasterUrl: options.MasterUrl,
                //MasterUrl: options.MasterUrl,
                //EnableMinimalDownload: options.MinimalDownload
            }
        };
        var deffered = $q.defer().promise;
        // Because we don't have the hidden __REQUESTDIGEST variable, we need to ask the server for the FormDigestValue
        var __REQUESTDIGEST;
        var rootUrl = location.protocol + "//" + location.host;

        var contextInfoPromise = $http({
            url: webUrl + "_api/contextinfo",
            method: "POST",
            headers: {
                "Accept": "application/json; odata=verbose"
            },
            success: function (data) {
                __REQUESTDIGEST = data.d.GetContextWebInformation.FormDigestValue;
            },
            error: function (data, errorCode, errorMessage) {
                alert(errorMessage);
            }
        });

        // Once we have the form digest value, we can create the subsite
        $q.when(contextInfoPromise).done(function () {
            $http({
                url: webUrl + "_api/web/webinfos/add",
                type: "POST",
                headers: {
                    "accept": "application/json;odata=verbose",
                    "content-type": "application/json;odata=verbose",
                    "X-RequestDigest": __REQUESTDIGEST
                },
                data: JSON.stringify(createData)
            }).then(function (data) {
                deffered.resolve(data);
            });
        });
        return deffered;
    }
    this.GetWebData = function GetWebData(webUrl) {
        webUrl = self.SanitizeWebUrl(webUrl);
        throw {
            name: "GetWebData",
            level: "Not Implemented",
            message: "Not Implemented",
            htmlMessage: "Not Implemented",
            toString: function () { return this.name + ": " + this.message; }
        };
        var url = webUrl + "_api/web";

        var promise = $http({
            url: url,
            method: "GET",
            headers: { "Accept": "application/json; odata=verbose" }
        });
        return promise;
    }
    this.UpdateWebData = function UpdateWebData(webUrl, updateData) {
        webUrl = self.SanitizeWebUrl(webUrl);
        throw {
            name: "UpdateWebData",
            level: "Not Implemented",
            message: "Not Implemented",
            htmlMessage: "Not Implemented",
            toString: function () { return this.name + ": " + this.message; }
        };

        var __REQUESTDIGEST;
        var contextInfoPromise = $http({
            url: webUrl + "_api/contextinfo",
            method: "POST",
            headers: {
                "Accept": "application/json; odata=verbose"
            },
            success: function (data) {
                __REQUESTDIGEST = data.d.GetContextWebInformation.FormDigestValue;
            },
            error: function (data, errorCode, errorMessage) {
                alert(errorMessage);
            }
        });
        var deff = $q.defer().promise;
        updateData.__metadata = { "type": "SP.Web" };
        $q.when(contextInfoPromise).done(function () {
            self.GetWebData(webUrl).then(function (data) {
                $http({
                    url: data.d.__metadata.uri,
                    type: "POST",
                    contentType: "application/json;odata=verbose",
                    data: JSON.stringify(updateData),
                    headers: {
                        "Accept": "application/json;odata=verbose",
                        "X-RequestDigest": $("#__REQUESTDIGEST").val(),
                        "X-HTTP-Method": "MERGE",
                        "If-Match": data.d.__metadata.etag
                    }
                }).then(function (data1) { deff.resolve(data1) }, function (data1) { deff.reject(data1) });
            });
        });
        return deff;
    }

    this.Search = function Get(webUrl, options) {
        webUrl = self.SanitizeWebUrl(webUrl);

        var clientContext = new SP.ClientContext(webUrl);

        var keywordQuery = new Microsoft.SharePoint.Client.Search.Query.KeywordQuery(clientContext);
        if (typeof (options.querytext) !== "undefined") {
            keywordQuery.set_queryText(options.querytext);
        }
        if (typeof (options.rowlimit) !== "undefined") {
            keywordQuery.set_rowLimit(options.rowlimit);
        }
        if (typeof (options.trimduplicates) !== "undefined") {
            keywordQuery.set_trimDuplicates(options.trimduplicates);
        }
        if (typeof (options.sortlist) !== "undefined") {
            keywordQuery.set_sortList(options.sortlist);
        }
        if (typeof (options.querytemplate) !== "undefined") {
            keywordQuery.set_queryTemplate(options.querytemplate);
        }
        if (typeof (options.enableinterleaving) !== "undefined") {
            keywordQuery.set_enableInterleaving(options.enableinterleaving);
        }
        if (typeof (options.sourceid) !== "undefined") {
            keywordQuery.set_sourceId(options.sourceid);
        }
        if (typeof (options.rankingmodelid) !== "undefined") {
            keywordQuery.set_rankingModelId(options.rankingmodelid);
        }
        if (typeof (options.startrow) !== "undefined") {
            keywordQuery.set_startRow(options.startrow);
        }
        if (typeof (options.rowsperpage) !== "undefined") {
            keywordQuery.set_rowsPerPage(options.rowsperpage);
        }
        if (typeof (options.selectproperties) !== "undefined") {
            var selectProperties = keywordQuery.get_selectProperties();
            var properties = [].concat(options.selectproperties);
            for (var i = 0; i < properties.length; i++) {
                selectProperties.add(properties[i]);
            }
        }
        if (typeof (options.trimduplicates) !== "undefined") {
            keywordQuery.set_trimDuplicates(options.trimduplicates);
        }
        if (typeof (options.trimduplicates) !== "undefined") {
            keywordQuery.set_trimDuplicates(options.trimduplicates);
        }
        if (typeof (options.trimduplicates) !== "undefined") {
            keywordQuery.set_trimDuplicates(options.trimduplicates);
        }
        if (typeof (options.trimduplicates) !== "undefined") {
            keywordQuery.set_trimDuplicates(options.trimduplicates);
        }
        if (typeof (options.trimduplicates) !== "undefined") {
            keywordQuery.set_trimDuplicates(options.trimduplicates);
        }
        if (typeof (options.trimduplicates) !== "undefined") {
            keywordQuery.set_trimDuplicates(options.trimduplicates);
        }
        if (typeof (options.trimduplicates) !== "undefined") {
            keywordQuery.set_trimDuplicates(options.trimduplicates);
        }
        if (typeof (options.trimduplicates) !== "undefined") {
            keywordQuery.set_trimDuplicates(options.trimduplicates);
        }
        if (typeof (options.trimduplicates) !== "undefined") {
            keywordQuery.set_trimDuplicates(options.trimduplicates);
        }
        if (typeof (options.trimduplicates) !== "undefined") {
            keywordQuery.set_trimDuplicates(options.trimduplicates);
        }
        if (typeof (options.trimduplicates) !== "undefined") {
            keywordQuery.set_trimDuplicates(options.trimduplicates);
        }
        if (typeof (options.trimduplicates) !== "undefined") {
            keywordQuery.set_trimDuplicates(options.trimduplicates);
        }
        if (typeof (options.trimduplicates) !== "undefined") {
            keywordQuery.set_trimDuplicates(options.trimduplicates);
        }
        if (typeof (options.trimduplicates) !== "undefined") {
            keywordQuery.set_trimDuplicates(options.trimduplicates);
        }
        if (typeof (options.trimduplicates) !== "undefined") {
            keywordQuery.set_trimDuplicates(options.trimduplicates);
        }
        if (typeof (options.trimduplicates) !== "undefined") {
            keywordQuery.set_trimDuplicates(options.trimduplicates);
        }
        if (typeof (options.trimduplicates) !== "undefined") {
            keywordQuery.set_trimDuplicates(options.trimduplicates);
        }
        if (typeof (options.trimduplicates) !== "undefined") {
            keywordQuery.set_trimDuplicates(options.trimduplicates);
        }
        if (typeof (options.trimduplicates) !== "undefined") {
            keywordQuery.set_trimDuplicates(options.trimduplicates);
        }

        /*culture
        refiners
        refinementfilters
        hiddenconstraints
        enablestemming
        trimduplicatesincludeid
        timeout
        enablenicknames
        enablephonetic
        enablefql
        hithighlightedproperties
        bypassresulttypes
        processbestbets
        clienttype
        personalizationdata
        resultsurl
        querytag
        enablequeryrules
        enablesorting*/


        var searchExecutor = new Microsoft.SharePoint.Client.Search.Query.SearchExecutor(clientContext);
        var results = searchExecutor.executeQuery(keywordQuery);

        var ctx = {
            results: results
        };
        var deff = $q.defer();
        clientContext.executeQueryAsync(
            Function.createDelegate(ctx,
                function () {
                    var obj = {
                        ElapsedTime: this.results.m_value.ElapsedTime,
                        PrimaryQueryResult: {
                            RefinementResults: [],
                            RelevantResults: [],
                            SpecialTermResults: []
                        },
                        SpellingSuggestion: this.results.m_value.SpellingSuggestion
                    };
                    var results = this.results;
                    $.each(results.m_value.ResultTables, function (index, table) {
                        if (table.TableType == "RelevantResults") {
                            obj.PrimaryQueryResult.RelevantResults = results.m_value.ResultTables[index].ResultRows;
                        }
                        else if (table.TableType == "RefinementResults") {
                            obj.PrimaryQueryResult.RefinementResults = results.m_value.ResultTables[index].ResultRows;
                        }
                        else if (table.TableType == "SpecialTermResults") {
                            obj.PrimaryQueryResult.SpecialTermResults = results.m_value.ResultTables[index].ResultRows;
                        }
                    });

                    deff.resolve(obj);
                }),
            Function.createDelegate(ctx,
                function (sender, args) {
                    deff.reject(args);
                })
        );

        return deff.promise;
    }
    // sets JSOM field type of an item based on type of field
    this.setSPField = function (spListItem, field, value) {

        var clientContext = SP.ClientContext.get_current();
        //console.log(field.TypeAsString, value);
        switch (field.TypeAsString) {
            case "User":
                if (value === null || (!value.Id && !value.ID)) {
                    value = null;
                    break;
                }
                var user = new SP.FieldUserValue();
                user.set_lookupId(value.Id || value.ID);
                value = user;
                break;
            case "UserMulti":
                if (value === null || value.length === 0 || !value.results) {
                    value = null;
                    break;
                }
                var users = [];
                for (var i = 0; i < value.results.length; i++) {
                    var user = new SP.FieldUserValue();
                    user.set_lookupId(value.results[i].Id || value[i].ID);
                    users.push(user);
                }
                value = users;
                break;
            case "Lookup":
                if (value === null || (!value.Id && !value.ID)) {
                    value = null;
                    break;
                }
                var lookup = new SP.FieldLookupValue();
                lookup.set_lookupId(value.Id || value.ID);
                value = lookup;
                break;
            case "LookupMulti":
                if (value === null || value.length === 0 || !value.results) {
                    value = null;
                    break;
                }
                var lookups = [];
                for (var i = 0; i < value.results.length; i++) {
                    var lookup = new SP.FieldLookupValue();
                    lookup.set_lookupId(value.results[i].Id || value[i].ID);
                    lookups.push(lookup);
                }
                value = lookups;
                break;
            case "Yes/No":
                if (value === true) value = 1;
                else if (value === false) value = 0;
                break;
            case "DateTime":
                if (value === null) break;
                else if (value instanceof Date) value = value.toISOString();
                else value = value;
                break;
            default: value = value;
        }
        spListItem.set_item(field.InternalName, value);
    };
    this.batchCreate = function (listTitle, items, fields, properties) {

        var deferred = $q.defer();

        var clientContext = SP.ClientContext.get_current();
        var oList = clientContext.get_web().get_lists().getByTitle(listTitle);

        var maxQuery = 50;
        var record = 0;

        chunkQuery();

        function chunkQuery() {

            var itemArray = [];

            for (var i = 0; i < maxQuery && record < items.length; i++, record++) {

                // apply global properties if necessary

                if (properties) {
                    for (property in properties) {
                        items[record][property] = properties[property];
                    }
                }

                var itemCreateInfo = new SP.ListItemCreationInformation();
                var oListItem = oList.addItem(itemCreateInfo);

                // populate fields
                angular.forEach(items[record], function (value, key) {
                    if (fields[key] && (fields[key].CanBeDeleted || key === "Title") && !fields[key].Hidden && !fields[key].ReadOnlyField) {
                        self.setSPField(oListItem, fields[key], value);
                    }
                });

                oListItem.update();
                itemArray[i] = oListItem;
                clientContext.load(itemArray[i]);
            }

            //console.log(itemArray);

            clientContext.executeQueryAsync(success, failure);
        }

        function success(sender, args) {
            if (record < items.length) {
                deferred.notify({ current: record, percentComplete: record / items.length });
                chunkQuery();
            } else {
                //console.log(this, sender);
                deferred.resolve("Success!");
            }
        }

        function failure(sender, args) {
            deferred.resolve("Update failed");
        }

        return deferred.promise;

    };

    this.batchDelete = function (listTitle, items) {

        var deferred = $q.defer();

        var clientContext = SP.ClientContext.get_current();
        var oList = clientContext.get_web().get_lists().getByTitle(listTitle);

        var maxQuery = 200;
        var record = 0;

        chunkQuery();

        function chunkQuery() {

            var itemArray = [];

            for (var i = 0; i < maxQuery && record < items.length; i++, record++) {
                var oListItem = oList.getItemById(items[record].ID);
                items[record].$updating = true;
                oListItem.deleteObject();
            }

            clientContext.executeQueryAsync(function (sender, args) {
                if (record < items.length) {
                    deferred.notify({ current: record, percentComplete: record / items.length });
                    chunkQuery();
                } else {
                    //console.log(this, sender);
                    deferred.resolve("Success!");
                }
            }, function (sender, args) {
                deferred.resolve("Update failed");
            });
        }

        return deferred.promise;

    };
}]);

