var sharepointModule = angular.module("app.sharepoint", []).config(function($httpProvider) {
	
	// default http headers
	$httpProvider.defaults.headers.common.Accept = "application/json;odata=verbose";
    
    $httpProvider.defaults.headers.post['Content-Type'] = 'application/json;odata=verbose';
    $httpProvider.defaults.headers.post['X-Requested-With'] = 'XMLHttpRequest';
    $httpProvider.defaults.headers.post['If-Match'] = "*";
   	$httpProvider.defaults.headers.post['X-RequestDigest'] = $('#__REQUESTDIGEST').val();
   	
});

sharepointModule.factory("currencySymbols", function currencySymbols() {
	return {
		"USD": "$",
		"GBP": "£",
		"EUR": "€",
		"JPY": "¥"
	}
});

sharepointModule.service("$utils", function() {

	this.browser = function() {
		return window.navigator.userAgent;
	};
	
	this.detectIE = function() {
    	var ua = window.navigator.userAgent;

    	var msie = ua.indexOf('MSIE ');
    	if (msie > 0) {
    	    // IE 10 or older => return version number
    	    return parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
    	}
	
    	var trident = ua.indexOf('Trident/');
    	if (trident > 0) {
    	    // IE 11 => return version number
    	    var rv = ua.indexOf('rv:');
    	    return parseInt(ua.substring(rv + 3, ua.indexOf('.', rv)), 10);
    	}
	
    	var edge = ua.indexOf('Edge/');
    	if (edge > 0) {
    	   // IE 12 => return version number
    	   return parseInt(ua.substring(edge + 5, ua.indexOf('.', edge)), 10);
    	}
	
    	// other browser
    	return false;
	};

});

sharepointModule.service("$alert", ["$q", "$http", "$compile", "$rootScope", function($q, $http, $compile, $rootScope) {

	var alert = this;
	
	var modalScope = $rootScope.$new();
	var modal;
	
	$http.get(_spPageContextInfo.webAbsoluteUrl + "/SiteAssets/HTML/partials/alert-modal.html").then(function(response) {
		alert.template = response.data;
		modal = $compile(response.data)(modalScope);
		$("body").append(modal);
	});
	
	this.show = function(params) {
		var deferred = $q.defer();
		
		if (params.title) modalScope.title = params.title;
		else modalScope.title = "Alert";
		
		if (params.message) modalScope.message = params.message;
		else modalScope.message = params.message;
		
		if (params.confirm) {
			modalScope.confirm = true;
			modalScope.answer = null;
		}
		else {
			modalScope.confirm = false;
			modalScope.answer = null;
		}
		
		modal.modal("show");
		
		modal.on("hide.bs.modal", function() {
			deferred.resolve(modalScope.confirmed);
		});
		
		return deferred.promise;
	};

}]);

sharepointModule.service("$validate", ["$q", "$http", function($q, $http) {

	var validate = this;
	
	validate._validators = {};
	
	validate._item = {};
	
	validate.register = function(name, v) {
		if (angular.isArray(v)) {
			if (validate._validators[name]) {
				for (i = 0; i < v.length; i++) {
					validate._validators[name].push(v);
				}
			} else {
				validate._validators[name] = v;
			}
		}
		else {
			if (validate._validators[name]) validate._validators[name].push(v);
			else validate._validators[name] = [v];
		}
		return validate;
	};

	validate.item = function(item) {
		validate._item = item;
		return validate;
	};
	
	validate.as = function(name) {
		var result = true;
		for (v = 0; v < validate._validators[name].length; v++) {
			if (validate._validators[name][v].call(validate._validators[name][v], validate._item) === false) {
				result = false;
				break;
			}
		}	
		return result;
	};

}]);

sharepointModule.controller("alertCtrl", ["$scope", "$timeout", "$sharepoint", "$q", "$alert", function($scope, $timeout, $sharepoint, $q, $alert) {

	$scope.answer = function(answer) {
		$scope.$parent.confirmed = answer;
	};
	
}]);

sharepointModule.service("$sharepoint", ["$http", "$q", "$alert", "$interval", function($http, $q, $alert, $interval) {

	var sharepoint = this;

	this.site = _spPageContextInfo.webAbsoluteUrl;
	this.user = {id: _spPageContextInfo.userId, name: ""};
	
	this.requestDigest = function() {
		return $('#__REQUESTDIGEST').val();
	};
	
	// refresh the REQUESTDIGEST every 2 minutes
	$interval(function() {
		$http.post(sharepoint.site + "/_api/contextinfo", {}).success(function(data) {
			var digest = data.d.GetContextWebInformation.FormDigestValue;
			$("#__REQUESTDIGEST").val(digest);
			$http.defaults.headers.post['X-RequestDigest'] = $('#__REQUESTDIGEST').val();
		});
	}, 120000);
	
	//_spFormDigestRefreshInterval;

	//window.sharepoint = this;
	
	this.lists = {};

	this.list = function(id) {
	
		var list = this;
		
		if (id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) this.url = sharepoint.site + "/_api/web/lists(guid'" + id + "')";
		else this.url = sharepoint.site + "/_api/web/lists/GetByTitle('" + id + "')";
		
		this.id = id;
		
		this.getList = function() {
			var deferred = $q.defer();
			if (sharepoint.lists[list.id]) deferred.resolve(sharepoint.lists[list.id]);
			else {
				sharepoint.lists[list.id] = deferred.promise;
				$http({
					method: "GET",
					url: list.url
				}).success(function(data, status, headers, config) {
					var list = data.d;
					if (list.Fields.__deferred) {
						sharepoint.getDeferred(list.Fields).then(function(response) {
							list.Fields = _.indexBy(response, "InternalName");
							sharepoint.lists[list.Title] = list;
							sharepoint.lists[list.Id] = list;
							deferred.resolve(list);
						});
					} else {
						sharepoint.lists[list.Title] = list;
						sharepoint.lists[list.Id] = list;
						deferred.resolve(list);
					}
				}).error(function (data, status, headers, config) {
					deferred.reject();
				});
			}
			return deferred.promise;
		};
		
		this.getItems = function(params) {
			var deferred = $q.defer();
			if (params) {
				var filters = [];
				if (params.select) filters.push("$select=" + params.select);
				if (params.expand) filters.push("$expand=" + params.expand);
				if (params.filter) filters.push("$filter=" + params.filter);
				if (params.top) filters.push("$top=" + params.top);
				if (params.orderby) filters.push("$orderby=" + params.orderby);
				var query = "?" + filters.join("&");
			}
			list.getList().then(function(l) {
				if (!params || !params.viewXml) {
					var paged = params ? params.paged : false;
					sharepoint.getDeferred(l.Items, query, paged).then(function(items) {
						/*
						for (var i = 0; i < items.length; i++) {
							items[i].$list = l;
						}
						*/
						deferred.resolve(items);
					}, function() {
					
					}, function(next) {
						deferred.notify(next);
					});
				}
				else {
					sharepoint.getViewXml(l, params.viewXml).then(function(items) {
						for (var i = 0; i < items.length; i++) {
							items[i].$list = l;
						}
						deferred.resolve(items);
					});
				}
			});
			return deferred.promise;
		};
		
		this.getFiles = function(params) {
			var deferred = $q.defer();
			if (params) {
				var filters = [];
				if (params.select) filters.push("$select=" + params.select);
				if (params.expand) filters.push("$expand=" + params.expand);
				if (params.filter) filters.push("$filter=" + params.filter);
				if (params.top) filters.push("$top=" + params.top);
				if (params.orderby) filters.push("$orderby=" + params.orderby);
				var query = "?" + filters.join("&");
			}
			list.getList().then(function(list) {
				return sharepoint.getDeferred(list.RootFolder);
			}).then(function(rootFolder) {
				return sharepoint.getDeferred(rootFolder.Files);
			}).then(function(files) {
				deferred.resolve(files);
			});
			return deferred.promise;
		};
		
		// fields method
		this.getFields = function(params) {
			var deferred = $q.defer();
			if (params) {
				var filters = [];
				if (params.select) filters.push("$select=" + params.select);
				if (params.expand) filters.push("$expand=" + params.expand);
				if (params.filter) filters.push("$filter=" + params.filter);
				if (params.top) filters.push("$top=" + params.top);
				var query = "?" + filters.join("&");
			}
			list.getList().then(function(list) {
				sharepoint.getDeferred(list.Fields, query).then(function(fields) {
					deferred.resolve(_.indexBy(fields, "InternalName"));
				});
			});
			return deferred.promise;
		};
		
		// content types method
		this.getContentTypes = function(id) {
			var deferred = $q.defer();
			if (id) var query = "('" + id + "')";
			list.getList().then(function(list) {
				sharepoint.getDeferred(list.ContentTypes, query).then(function(contentTypes) {
					deferred.resolve(contentTypes);
				});
			});
			return deferred.promise;
		};
		
		this.updateItems = function(items, properties) {
			var deferred = $q.defer();
			list.getList().then(function(list) {
				sharepoint.getDeferred(list.Fields).then(function(fields) {
					var fields = _.indexBy(fields, "InternalName");
					sharepoint.batchUpdate(list.Title, items, fields, properties).then(function(result) {
						deferred.resolve(result);
					}, function() {
						// failure callback
					}, function(status) {
						// notify callback
						deferred.notify(status);
					});
				});
			});
			return deferred.promise;
		};
		
		this.createItem = function(item) {
			var deferred = $q.defer();
			list.getList().then(function(list) {
				item["__metadata"] = {
					"type": list.ListItemEntityTypeFullName
				};
				
				/*
				$http.post(sharepoint.site + "/_api/contextinfo", {}).success(function(data) {
					// continue on success
				}).error(function() {
					return deferred.reject();
				}).then(function(response) {
					var digest = response.data.d.GetContextWebInformation.FormDigestValue;
					return $http.post(list.Items.__deferred.uri, item, {headers: {"X-RequestDigest": digest}});
				}).then(function(response) {
					deferred.resolve(response.data.d);
				});
				*/
				
				$http.post(list.Items.__deferred.uri, item).success(function(data) {
					deferred.resolve(data.d);
				}).error(function() {
					deferred.reject();
					$alert.show({title: "Error Saving", message: "There was an error creating the list item."});
				});
				
			});
			return deferred.promise;
		};
		
		this.createItems = function(items) {
			var deferred = $q.defer();
			list.getList().then(function(list) {
				sharepoint.getDeferred(list.Fields).then(function(fields) {
					var fields = _.indexBy(fields, "InternalName");
					sharepoint.batchCreate(list.Title, items, fields).then(function(result) {
						deferred.resolve(result);
					});
				});
			});
			return deferred.promise;
		};
		
		this.deleteItems = function(items) {
			var deferred = $q.defer();
			list.getList().then(function(list) {
				sharepoint.batchDelete(list.Title, items).then(function(result) {
					deferred.resolve(result);
				});
			});
			return deferred.promise;
		};
				
		return this;
	};
	
	this.getUsersByName = function(name, groupId) {
		var deferred = $q.defer();
		// need to convert name to upper case since it is case sensitive and cannot use toupper() or tolower() OData functions
		name = name.split(" ");
		for (var i = 0; i < name.length; i++) {
			name[i] = name[i].slice(0,1).toUpperCase() + name[i].slice(1).toLowerCase();
		}
		if (!groupId) var request = "/siteusers?$filter=substringof('" + name.join(" ") + "',Title) eq true";
		else var request = "/sitegroups(" + groupId + ")/users?$filter=substringof('" + name.join(" ") + "',Title) eq true";
		$http({
			method: "GET",
			url: sharepoint.site + "/_api/web" + request
		}).success(function(data, status, headers, config) {
			if (data.d.results) deferred.resolve(data.d.results);
			else deferred.resolve(data.d);
		}).error(function (data, status, headers, config) {
			deferred.reject();
		}).then(function(response) {
		});
		return deferred.promise;
	};
	
	this.getGroup = function(name) {
		var deferred = $q.defer();
		$http({
			method: "GET",
			url: sharepoint.site + "/_api/web/sitegroups/getbyname('" + name + "')"
		}).success(function(data, status, headers, config) {
			var group = data.d;
			sharepoint.getDeferred(data.d.Users).then(function(users) {
				group.Users = users;
				deferred.resolve(group);
			});
		}).error(function (data, status, headers, config) {
			deferred.reject();
		});
		
		return deferred.promise;
	};
	
	// generic method to return deferred properties
	this.getDeferred = function(obj, query, paged) {
		var deferred = $q.defer();
		if (obj.__deferred) {
			$http({
				method: "GET",
				url: obj.__deferred.uri + (query || "")
			}).success(function(data, status, headers, config) {
				if (paged) deferred.resolve(data.d);
				else if (data.d.results) deferred.resolve(data.d.results);
				else deferred.resolve(data.d);
			}).error(function (data, status, headers, config) {
				deferred.reject();
			});
		} else deferred.resolve(obj);
		return deferred.promise;
	};
	
	this.uploadFile = function(path) {
		var deferred = $q.defer();
		if (!window.FileReader) {
    		$alert.show({title: "Not Supported", message: "Sorry, your browser does not support this feature.  Please use a modern browser (Chrome, Firefox, Safari or Internet Explorer 10+) to upload files."}).then(function() {
    			deferred.reject();
    		});
    	} else {
    	
    		var filepicker = $("<input type='file' id='filepicker' />");
					
			filepicker.on("change", function(event) {
	    		readFiles(event.currentTarget.files);
	    	});
	    			
	    	filepicker.click();
	    	
	    	function readFiles(files) {
		    	for (var i = 0; i < files.length; i++) {
					var reader = new FileReader();
					var filename = files[i].name;
					var type = files[i].type;
					reader.onload = function(e) {
						
						var arrayBuffer = e.target.result;
						var upload = $q.defer();
						
						deferred.notify("uploading");
						
						/*
						$http.post(sharepoint.site + "/_api/contextinfo", {}).success(function(data) {
							var digest = data.d.GetContextWebInformation.FormDigestValue;
							// using ajax here to set "processData" to false
						*/
							$.ajax({
								url: sharepoint.site + "/_api/web/GetFolderByServerRelativeUrl('" + path + "')/Files/add(url='" + (Math.floor((Math.random() * 10000000000) + 1)) + "-" + filename + "',overwrite=true)",
								type: "POST",
	            				data: arrayBuffer,
	            				processData: false,
								headers: {
									"accept": "application/json;odata=verbose",
									"X-RequestDigest": $('#__REQUESTDIGEST').val(),
								},
								success: function(data) {
									upload.resolve(data.d);
								},
								error: function(data) {
									upload.reject();
								}
							});
						/*
						}).error(function(data) {
							console.log(data);
						});
						*/
						
						
						upload.promise.then(function(file) {
							return sharepoint.getDeferred(file.ListItemAllFields);
						}).then(function(listItem) {
							return sharepoint.updateItem(listItem, {Title: filename.replace(/\.\w{3,4}$/,"")});
						}).then(function(listItem) {
							deferred.resolve(listItem);
						});
				    };
				    reader.readAsArrayBuffer(files[i]);
				}
		    }
    		
		}
		return deferred.promise;
	};
	
	this.getSiteUsers = function(id) {
		if (!id) id = "";
		var deferred = $q.defer();
		$http.get(sharepoint.site + "/_api/web/siteusers(" + id + ")").success(function(data) {
			deferred.resolve(data.d.results);
		});
		return deferred.promise;
	};
	
	this.deleteFile = function(path) {
		return $http({
			url: sharepoint.site + "/_api/web/GetFileByServerRelativeUrl('" + path + "')",
			method: "POST",
			headers: {
				"X-HTTP-Method": "DELETE"
			}
		});
	};
	
	// generic update via HTTP MERGE request uses item metadata and applies properties
	this.updateItem = function(item, properties) {
		var deferred = $q.defer();
		var data = {"__metadata": {"type": item.__metadata.type}};
		
		for (property in properties) {
			data[property] = properties[property];
		}
		
		/*
		$http.post(sharepoint.site + "/_api/contextinfo", {}).success(function(data) {
			// continue on success
		}).error(function() {
			return deferred.reject();
		}).then(function(response) {
			var digest = response.data.d.GetContextWebInformation.FormDigestValue;
			return $http({method: "POST", url: item.__metadata.uri, headers: {"X-HTTP-Method": "MERGE", "X-RequestDigest": digest}, data: data});
		}).then(function(){
			return $http.get(item.__metadata.uri);
		}).then(function(response) {
			deferred.resolve(response.data.d);
		});
		*/
		$http.post(item.__metadata.uri, data, {headers: {"X-HTTP-Method": "MERGE"}}).success(function(data) {
			$http.get(item.__metadata.uri).success(function(data) {
				deferred.resolve(data.d);
			}).error(function() {
				deferred.reject();
			});
		}).error(function() {
			$alert.show({title: "Error Updating Item", message: "There was an error updating the list item."});
			deferred.reject();
		});

		return deferred.promise;
	};
	
	this.getViewXml = function(list, viewXml) {
	
		var deferred = $q.defer();

		var clientContext = SP.ClientContext.get_current();
		var oList = clientContext.get_web().get_lists().getByTitle(list.Title);
				        
		var camlQuery = new SP.CamlQuery();
		camlQuery.set_viewXml(viewXml);
		var collListItems = oList.getItems(camlQuery);

		clientContext.load(collListItems);
		
		clientContext.executeQueryAsync(success, failure); 
		
		function success(sender, args) {
			var listItemInfo = "";
			var listItemEnumerator = collListItems.getEnumerator();
        
        	var items = [];
			while (listItemEnumerator.moveNext()) {
				var oListItem = listItemEnumerator.get_current();
				var item = oListItem.get_fieldValues();
				for (field in list.Fields) {
					sharepoint.getSPField(item, list.Fields[field]);
				}
				items.push(item);
			}
			//console.log(items);
			deferred.resolve(items);
		}

		function failure(sender, args) {
			//console.log("Request failed. " + args.get_message() + "\n" + args.get_stackTrace());
			deferred.reject();
		}

		return deferred.promise;
	};
	
	// JSOM methods for batch updates and creation
	this.batchUpdate = function(listTitle, items, fields, properties) {
		
		var deferred = $q.defer();
		
		var clientContext = SP.ClientContext.get_current();
		var list = clientContext.get_web().get_lists().getByTitle(listTitle);
		
		var maxQuery = 50;
		var record = 0;
		
		var listItems = [];
		
		chunkQuery();
		
		function chunkQuery() {
		
			listItems = [];
			
			for (var i = 0; i < maxQuery && record < items.length; i++, record++) {
		
				var listItem = list.getItemById(items[record].ID);
				
				items[record].$updating = true;
				
				// apply batch properties if any
				angular.forEach(properties, function(value, key) {
					items[record][key] = value;
				});
				
				//console.log(fields);
				
				// set existing changeable properties
				angular.forEach(items[record], function(value, key) {
					if (fields[key] && (fields[key].CanBeDeleted || key === "Title") && !fields[key].Hidden && !fields[key].ReadOnlyField) {
						sharepoint.setSPField(listItem, fields[key], value);
					}
				});
				
				listItems.push(listItem);
				listItem.update();
				
				clientContext.load(listItem);
			
			}
			
			clientContext.executeQueryAsync(success, failure);
	
		}
			
		function success(context, request) {
       	
			for (var i = 0; i < listItems.length; i++) {
				
				var oListItem = listItems[i];
				var newItem = oListItem.get_fieldValues();
				var oldItem = _.findWhere(items, {ID: newItem.ID});

				for (field in fields) {
					if (fields[field].CanBeDeleted && !fields[field].Hidden) {
						oldItem[field] = sharepoint.getSPField(newItem, fields[field])[field];
					}
				}
				
				oldItem.$updating = false;
				
			}
			
			if (record < items.length) {
				deferred.notify({current: record, percentComplete: record / items.length});
				chunkQuery();
			} else {
		 		deferred.resolve(items);
		 	}
			
		}
		
		function failure(sender, args) {
		
			$alert.show({title: "Error Saving", message: "There was an error saving to SharePoint.  Please provide the following message to your site administrator: " + args.get_message()});
			
			for(var i = 0; i < items.length; i++) {
				items[i].$updating = false;
			}
			
			deferred.reject(false);
		}
		
		return deferred.promise;
	};
	
	this.batchCreate = function(listTitle, items, fields, properties) {
	
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
		        angular.forEach(items[record], function(value, key) {
					if (fields[key] && (fields[key].CanBeDeleted || key === "Title") && !fields[key].Hidden && !fields[key].ReadOnlyField) {
						sharepoint.setSPField(oListItem, fields[key], value);
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
				deferred.notify({current: record, percentComplete: record / items.length});
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
	
	this.batchDelete = function(listTitle, items) {
	
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
			
			clientContext.executeQueryAsync(function(sender, args) {
				if (record < items.length) {
					deferred.notify({current: record, percentComplete: record / items.length});
					chunkQuery();
				} else {
					//console.log(this, sender);
		 			deferred.resolve("Success!");
		 		}
			}, function(sender, args) {
				deferred.resolve("Update failed");
			});
		}
		 
		return deferred.promise;
	
	};
	
	// sets JSOM field type of an item based on type of field
	this.setSPField = function(spListItem, field, value) {
	
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
	
	// decodes JSOM objects and turns into regular javascript objects compatible with REST apis
	this.getSPField = function(item, field) {
	
		var fieldName = field.InternalName;
		
		if (item[fieldName] === null || typeof item[fieldName] === "undefined") {
			switch(field.TypeAsString) {
				case "Lookup":
				case "User":
				case "UserMulti":
					item[fieldName] = {};
					break;
			}
			return item;
		}
		
		switch (field.TypeAsString) {
			case "Lookup":
				item[fieldName] = translateSPObject(item[fieldName], field);
				break;
			case "LookupMulti":
				var lookups = angular.copy(item[fieldName]);
				item[fieldName] = {"results": []};
				for (var l = 0; l < lookups.length; l++) {
					var lookup = translateSPObject(lookups[l], field);
					item[fieldName].results.push(lookup);
				}
				break;
			case "User":
				item[fieldName] = translateSPObject(item[fieldName], field);
				break;
			case "UserMulti":
				var users = angular.copy(item[fieldName]);
				item[fieldName] = {"results": []};
				for (var u = 0; u < users.length; u++) {
					var user = translateSPObject(users[u], field);
					item[fieldName].results.push(user);
				}
				break;
			case "Guid":
			case "ContentTypeId":
			case "Lookup":
			case "User":
				item[fieldName] = translateSPObject(item[fieldName], field);
			default: return item;
		}
		
		return item;

		function translateSPObject(SPObject, field) {
			var fieldName = field.InternalName;
			if (!SPObject.constructor.toString().match(/SP.\w+/)) return SPObject; // native object
			var SPObjectName = SPObject.constructor.toString().match(/SP.\w+/)[0];
			var object = {};
			switch (SPObjectName) {
				case "SP.FieldLookupValue":
					object["Id"] = SPObject.get_lookupId();
					object[field.LookupField] = SPObject.get_lookupValue();
					break;
				case "SP.FieldUserValue":
					object["Id"] = SPObject.get_lookupId();
					object["Title"] = SPObject.get_lookupValue();
					break;
				case "SP.ContentTypeId":
				case "UniqueId":
				case "SP.Guid":
					object = SPObject.toString();
					break;
			}
			return object;
		}
		
	};

}]);

sharepointModule.directive("modal", function($compile, $timeout, $controller, $parse, $sharepoint) {
  return {
    restrict: 'A',
    controller: "@",
    scope: true,
    name: "modalController",
    link: function(scope, element, attrs) {
    
    	var siteRegex = new RegExp($sharepoint.site);
    	if (!siteRegex.test(attrs.modal)) scope.template = $sharepoint.site + attrs.modal;
    	else scope.template = attrs.modal;
   	
    	// parse the width attribute
    	if (!attrs.modalWidth) {
    		scope.width = "600px"; // default width
    	} else if (attrs.modalWidth.match(/%|px|em/)) {
    		scope.width = attrs.modalWidth;
    	} else {
    		try {
    			var width = parseInt(attrs.modalWidth);
    			if (width <= 10) scope.width = width + "em"; // assume this is em
    			else if (width > 10 && width <= 100) scope.width = width + "%"; // assume %
    			else if (width > 100) {
    				// assume px
    				if (width < 300) scope.width = 300 + "px";
    				else scope.width = width + "px";
    			}
    		} catch(error) {
    			// width could not be parsed
    			scope.width = "600px";
    		}
    	}
    	
    	if (attrs.modalClass) var modalClass = attrs.modalClass;
    	else var modalClass = "";
    
    	var modal = $compile("<div class=\"modal fade " + modalClass + "\"><div class=\"modal-dialog\" ng-style=\"{'width': width}\"><div class=\"modal-content\" ng-include=\"template\"></div></div></div>")(scope);
    
    	scope.modal = modal;
    	
    	scope.modal.modal({backdrop: "static", keyboard: false, show: false});

		element.on("click", function() {
			if (!attrs.modalIf) modal.modal("show");
			else if (scope.$eval(attrs.modalIf)) modal.modal("show");
		});
	
		// execute callback on close
		modal.on("hidden.bs.modal", function(event) {
			if (!modal.is(event.target)) return;	// to prevent conflict from datepicker, which calls 'hidden.bs.modal' when it open/closes
			var close = $parse(attrs.modalClose);
			close(scope);
		});
		
		// execute callback on open
		modal.on("show.bs.modal", function(event) {
			if (!modal.is(event.target)) return;
			var open = $parse(attrs.modalOpen);
			open(scope);
		});

    }
  };
});



sharepointModule.directive("tooltip", function($compile, $timeout, $sharepoint) {
  return {
    restrict: "A",
    scope: {
    	tooltipTitle: "@tooltip",
    	tooltipIf: "&",
    	tooltipDelay: "@",
    	tooltipPlacement: "@",
    	tooltipHtml: "=",
    	tooltipPermanent: "=",
    	tooltipContainer: "@"
    },
    link: function(scope, element, attrs) {
    
    	switch (scope.tooltipContainer) {
    		case "element": var container = element; break;
    		case "parent": var container = element.parent(); break;
    		default: var container = "body";
    	}
    
    	function create() {
	    	element.tooltip({
	    		placement: scope.tooltipPlacement || "top",
	    		container: container,
	    		title: scope.tooltipTitle,
	    		delay: scope.tooltipDelay || 0,
	    		html: scope.tooltipHtml || false,
	    		trigger: scope.tooltipPermanent ? "manual" : "hover focus"
	    	});
	    	//console.log("tooltip created");
	    	if (scope.tooltipPermanent) element.tooltip("show");
    	}
    	
    	function destroy() {
    		element.tooltip("destroy");
    	}
    	
    	if (!attrs.tooltipIf) create();
    	
    	scope.$watch("tooltipIf()", function(tooltip) {
    		//console.log(tooltip, attrs);
    		if (!tooltip && attrs.tooltipIf) destroy();
    		else create();
    	});
    	
    	scope.$watch("tooltipTitle", function(title) {
    		if (title && scope.tooltipIf()) {
    			element.tooltip("hide")
          			.attr("data-original-title", title)
          			.tooltip("fixTitle");
    		}
    	});
    	    
    }
  };
});


sharepointModule.directive("popover", function($compile, $http, $sharepoint, $parse, $templateCache) {
  return {
    restrict: "A",
    link: function(scope, element, attrs) {
    	
    	if (attrs.popoverNamespace) var clickEventNamespace = "click." + attrs.popoverNamespace;
    	else var clickEventNamespace = "click";
    	
    	if (attrs.popoverContentTemplate) {
    		$http.get($sharepoint.site + attrs.popoverContentTemplate, {cache: $templateCache}).then(function(content) {
    			scope.contentTemplate = $compile(content.data)(scope);
    		});
    	}
    	
    	scope.$watch("contentTemplate", function(template) {
    		if (template || !attrs.popoverContentTemplate) {
	    		element.popover({
	    			title: attrs.popoverTitle || "Title",
	    			placement: attrs.popoverPlacement || "right",
	    			html: true,
	    			content: template || attrs.popoverContent || "",
	    			container: attrs.popoverContainer || null,
	    			trigger: "manual"
	    		});
	    	}
    	});
    	
    	var popoverOpen = false;
    	
    	/*
    	scope.$watch(function() { return element.position().top; }, function(scroll) {
    		console.log(scroll);
    	});*/
    
		element.on("click", function() {
			if (!popoverOpen) element.popover("show");
			else element.popover("hide");
		});
		
		element.on("shown.bs.popover", function(event) {
			popoverOpen = true;
			popover = element.next();
			$("body").on(clickEventNamespace, function(event) {
				if (event.target !== element && event.target !== popover && popover.find(event.target).length === 0) {
					element.popover("hide");
				}
			});
		});
		
		element.on("hidden.bs.popover", function() {
			popoverOpen = false;
			$("body").off(clickEventNamespace);
		});
		
    }
  };
});

sharepointModule.directive("userSearch", function($compile, $timeout, $sharepoint) {
  return {
    restrict: "A",
    scope: {},
    template: "<input type='text' class='user-search-input' ng-model='searchText'/>"
    	+	"<ul class='user-search-list'>"
    	+		"<li class='selected-users' ng-repeat='user in selectedUsers'><i class='fa fa-check-circle'/></i> {{user.Title}}</li>"
    	+		"<li class='searched-users' ng-repeat='user in searchedUsers'><i class='fa fa-circle-thin'></i> {{user.Title}}</li>"
    	+	"</ul>",
    link: function(scope, element, attrs) {
    
		scope.$watch("searchText", function(text) {
		
		});
		
    }
  };
});

sharepointModule.directive("tableSelect", function($sharepoint) {
  return {
    restrict: "C",
    scope: true,
    link: function(scope, element, attrs) {
    
		function TableFilters() {
		
			var obj = this;
			
			var stringFilters = {};
			var objectFilters = {};
			
			this.add = function(field, value) {
				if (field.TypeAsString === "Calculated") {
					
					var fieldType = $(field.SchemaXml).attr("ResultType");
				}
				else var fieldType = field.TypeAsString;
				switch(fieldType) {
					case "Note":
					case "Text":
						stringFilters[field.InternalName] = "substringof('" + value + "', " + field.InternalName + ")";
						objectFilters[field.InternalName] = {type: fieldType, value: value};
						break;
					case "Currency":
						if (value.operator === "Greater Than") var operator = "gt";
						else if (value.operator === "Less Than") var operator = "lt";
						else if (value.operator === "Equal To") var operator = "eq";
						else if (value.operator === "Less Than or Equal To") var operator = "lte";
						else if (value.operator === "Greater Than or Equal To") var operator = "gte";
						stringFilters[field.InternalName] = operator + " " + value.value;
						objectFilters[field.InternalName] = {type: fieldType, operator: operator, value: value.value};
						break;
					case "Choice":
						if (value.length !== 0) stringFilters[field.InternalName] = "(" + field.InternalName + " eq '" + value.join("') or (" + field.InternalName + " eq '") + "')";
						else stringFilters[field.InternalName] = "";
						objectFilters[field.InternalName] = {type: fieldType, value: value};
						break;
					case "UserMulti":
					case "User":
						stringFilters[field.InternalName] = "substringof('" + value + "', " + field.InternalName + "/Title)";
						objectFilters[field.InternalName] = {type: fieldType, value: value};
						break;
				}
				obj.updateString();
			};
			this.remove = function(field) {
				delete stringFilters[field.InternalName];
				delete objectFilters[field.InternalName];
				obj.updateString();
			};
			this.clear = function() {
				for (sf in stringFilters) {
					delete stringFilters[sf];
				}
				obj.updateString();
				for (of in objectFilters) {
					delete objectFilters[of];
				}
			};
			this.string = null;
			this.updateString = function() {
				var string = [];
				for (filter in stringFilters) {
					string.push(stringFilters[filter]);
				}
				if (string.length > 1) obj.string = "(" + string.join(") and (") + ")";
				else if (string.length === 1) obj.string = string[0];
				else obj.string = null;
			};
			this.asString = function() {
				return obj.string;
			};
			this.asObject = function() {
				if (_.keys(objectFilters).length === 0) return null;
				else return objectFilters;
			};
		};
		
		scope.tableFilters = new TableFilters();
	
		scope.$on("tableSelectFilterChange", function(event, field, value, remove) {
			if (remove) scope.tableFilters.remove(field);
			else scope.tableFilters.add(field, value);
			scope.$emit("tableSelectQueryChange", scope.tableFilters.asString(), scope.tableFilters.asObject());
		});
		
		/*
		scope.$on("clearTableSelectFilters", function() {
			scope.tableFilters.clear();
			scope.$emit("tableSelectQueryChange", scope.tableFilters.asString(), scope.tableFilters.asObject());
		});
		*/
		
		scope.$watch("filteredItems", function(array) {
			if (array) scope.$emit("filteredItemsChange", array);
		});

		
    }
  };
});

sharepointModule.directive("tableSelectHeader", function($compile, $timeout, $sharepoint) {
  return {
    restrict: "A",
    scope: true,
    templateUrl: "/sites/NikeAccruals/SiteAssets/HTML/partials/table-select-header-template.html",
    link: function(scope, element, attrs) {
    
    	var popover = element.find(".popover");
    	var header = element.find("th");
    	scope.active = attrs.tableSelectHeaderActive ? scope.$eval(attrs.tableSelectHeaderActive) : true;
    	
    	scope.popoverShow = false;
    	
    	scope.popoverWidth = element.width();
    	scope.popoverTop = element.position().top + element.height();
    	var widthOffset = popover.width() > 150 ? popover.width() : 150;
    	scope.popoverLeft = element.position().left + (element.width() / 2) - (widthOffset / 2);

    	scope.$watch(function() { return element.position().top; }, function(top) {
    		scope.popoverTop = top + element.height();
    	});
    	
    	scope.$watch(function() { return element.position().left; }, function(left) {
    		var widthOffset = popover.width() > 150 ? popover.width() : 150;
    		scope.popoverLeft = left + (element.width() / 2) - (widthOffset / 2);
    	});
    
    	scope.$watch("fields", function(fields) {
    		if (fields) {
    			scope.field = fields[attrs.tableSelectHeader];
    			if (scope.field.TypeAsString === "Calculated") {
    				scope.fieldType = $(scope.field.SchemaXml).attr("ResultType");
    			}
    			else scope.fieldType = scope.field.TypeAsString;
    		}
    	});
    	
    	$("body").on("click", function(event) {
    		if (event.target != element && element.find(event.target).length === 0) {
    			// did NOT click on header or associated popover
	    		scope.$apply(function() {
    				scope.popoverShow = false;
    			});
    		} else {
    			// did click on header or associated popover
    			if (element.find(event.target).length > 0 && popover.find(event.target).length === 0 && scope.active) {
    				scope.$apply(function() {
    					scope.popoverShow = !scope.popoverShow;
    				});
    				if (scope.popoverShow) {
    					if (element.find("input[type='text'],input[type='number']").length > 0) $timeout(function() { element.find("input").focus(); }, 0);
    				}
    			}
    		}
    	});
    	
    	// do not submit form on enter, but hide filter
    	scope.inputKeydown = function(event) {
	   		if (event.which === 13) {
    			event.preventDefault();
    			scope.popoverShow = false;
    			scope.hover = false;
    		}
    	};
    	
    	scope.filterOn = false;
    	
    	scope.$watch("searchText", function(text) {
    		if (text) {
    			scope.$emit("tableSelectFilterChange", scope.field, text);
    			scope.filterOn = true;
    		}
    		else if (text === "") {
    			scope.$emit("tableSelectFilterChange", scope.field, text, true);
    			scope.filterOn = false;
    		}
    		else return;
    	});
    	
    	scope.clearSearchText = function() {
    		scope.searchText = "";
    		scope.popoverShow = false;
    		scope.hover = false;
    	};
    	
    	scope.operator = "Greater Than";
    	scope.$watch("operator", function(value) {
    		if (value && scope.searchValue) scope.$emit("tableSelectFilterChange", scope.field, {operator: scope.operator, value: scope.searchValue});
	   		if (element.find("input[type='text'],input[type='number']").length > 0) $timeout(function() { element.find("input").focus(); }, 0);
    	});
    	scope.$watch("searchValue", function(value) {
    		if (value) {
    			scope.$emit("tableSelectFilterChange", scope.field, {operator: scope.operator, value: value});
    			scope.filterOn = true;
    		}
    		else if (value === null) {
    			scope.$emit("tableSelectFilterChange", scope.field, {operator: scope.operator, value: value}, true);
    			scope.filterOn = false;
    		}
    		else {
    			//console.log(value);
    			return;
    		}
    	});
    	
    	scope.clearSearchValue = function() {
    		scope.searchValue = null;
    		scope.popoverShow = false;
    		scope.hover = false;
    		scope.operator = "Greater Than";
    	};
    	
    	scope.selections = {};
    	scope.$watchCollection("selections", function(selections) {
    		// don't fire change event the first time around - when selections will not have any keys
    		if (_.keys(selections).length === 0) return;
    		else {
	    		var array = [];
	    		for (choice in selections) {
	    			if (selections[choice] === true) array.push(choice);
	    		}
	    		scope.$emit("tableSelectFilterChange", scope.field, array, array.length === 0);
	    		if (array.length >= 1) scope.filterOn = true;
	    		else scope.filterOn = false;
    		}
    	});
    	
    	scope.clearSelections = function() {
    		for (choice in scope.selections) {
    			scope.selections[choice] = false;
    		}
    		scope.popoverShow = false;
    		scope.hover = false;
    	};
    	
    	scope.$watch("searchUserText", function(text) {
    		if (text) {
    			scope.$emit("tableSelectFilterChange", scope.field, text);
    			scope.filterOn = true;
    		}
    		else if (text === "") {
    			scope.$emit("tableSelectFilterChange", scope.field, text, true);
    			scope.filterOn = false;
    		}
    		else return;
    	});
    	
    	scope.clearSearchUserText = function() {
    		scope.searchUserText = "";
    		scope.popoverShow = false;
    		scope.hover = false;
    	};
    	
    	scope.$on("clearTableSelectFilters", function() {
			scope.clearAll();
		});
		
		scope.clearAll = function() {
			scope.clearSearchText();
			scope.clearSearchValue();
			scope.clearSelections();
			scope.filterOn = false;
		};
		
		/* resize functionality */
		var resizing = false;
		element.on("mouseover", function() {
    		var leftEdge = element.offset().left;
			var width = element.width();
			var rightEdge = leftEdge + width;
			$("body").on("mousemove", function(e) {
				if (e.pageX >= (rightEdge - 10) && e.pageX <= rightEdge) {
					if (!element.hasClass("resize")) {
						element.addClass("resize");
					}
				}
				else {
					if (!resizing) element.removeClass("resize");
				}
			});
    	});
    	
    	element.on("click", function(e) {
    		if (element.hasClass("resize")) e.stopPropagation(); // stop dropdown from opening   		
    	});
    	
    	element.on("mousedown", function(e) {
    		if (element.hasClass("resize")) {
    		
    			//	add a border for visual cue
    			element.addClass("resizeBorder");
    			var colIndex = element.index();
    			element.closest("table").find("tbody").find("tr").each(function() {
    				$(this).find("td").eq(colIndex).addClass("resizeBorder");
    			});
    			
    			resizing = true;
    			var lastX = e.pageX;
    			$("body").on("mousemove", function(e) {
    				var deltaX = e.originalEvent.movementX || e.pageX - lastX;
    				var originalWidth = element.width();
    				var minWidth = 40;
    				var newWidth = originalWidth + deltaX;
    				if (newWidth < minWidth) newWidth = minWidth;
    				element.width(newWidth);
    				lastX = e.pageX;
    			});
    		}
    	});
    	
    	$("body").on("mouseup", function() {
    		resizing = false;
    		$("body").off("mousemove");
    		//	remove border
    		element.removeClass("resizeBorder");
    		var colIndex = element.index();
    		element.closest("table").find("tbody").find("tr").each(function() {
    			$(this).find("td").eq(colIndex).removeClass("resizeBorder");
    		});

    	});
    	
    }
  };
});

sharepointModule.directive("resizableHeader", function() {
  return {
    restrict: "A",
    link: function(scope, element, attrs) {
    
    	element.on("mouseover", function() {
    		var leftEdge = element.position().left;
			var width = element.outerWidth(false);
			var rightEdge = leftEdge + width;
			element.on("mousemove", function(e) {
				if (e.pageX >= (rightEdge - 9)) element.addClass("resize");
				else element.removeClass("resize");
			});
    	});
    	
    	element.on("mouseout", function() {
    		element.off("mousemove");
    	});
    	
  
    }
  };
});


sharepointModule.directive("userSelect", function($timeout, $sharepoint) {
  return {
    restrict: "A",
    replace: true,
    scope: {
    	userModel: "=",
    	userMultiSelect: "&",
    	userGroup: "&"
    },
    template: "<div class=\"input-group user-select\">"
			+		"<span class=\"input-group-addon\"><i class=\"fa fa-fw\" ng-class=\"{'fa-user': !searching, 'fa-spinner': searching, 'fa-spin': searching}\"></i></span>"
			+		"<input type=\"text\" class=\"form-control\" ng-model=\"searchText\" ng-model-options=\"{debounce: 300}\" ng-keydown=\"checkInputEvent($event)\" placeholder=\"Search user name...\"/>"
			+		"<ul class=\"dropdown-menu\" ng-style=\"{'display': searchResults.length &gt; 0 ? 'block' : 'none', 'width': menuWidth + 'px', 'left': menuLeft + 'px'}\">"
			+			"<li role=\"presentation\" ng-repeat=\"user in searchResults\"><a tabindex=\"{{$index}}\" ng-keydown=\"checkItemEvent($event, user)\" ng-click=\"addUser(user)\">{{user.Title}}</a></li>"
			+		"</ul>"
			+	"</div>",
    link: function(scope, element, attrs) {
    
    	scope.searchResults = [];
    	
    	var input = element.find("input[type='text']");
    	
    	scope.$watch(function() { return input.outerWidth(); }, function(width) {
    		scope.menuWidth = width;
    	});
    	
    	scope.$watch(function() { return input.position().left; }, function(left) {
    		scope.menuLeft = left;
    	});
    
    	scope.checkInputEvent = function(event) {
			if (event.which === 40 && scope.searchResults.length > 0) {
				$timeout(function() { $(event.target).next().find("li a").first().focus(); }, 0);
			}
		};
							
		scope.checkItemEvent = function(event, user) {
			if (event.which === 38) {
				if ($(event.target).closest("li").index() === 0) {
					$timeout(function() { input.focus(); }, 0);
				} else $timeout(function() { $(event.target).closest("li").prev().find("a").focus(); }, 0);
			} else if (event.which === 40) {
				$timeout(function() { $(event.target).closest("li").next().find("a").focus(); }, 0);
			} else if (event.which === 13) {
				scope.addUser(user);
			}
		};
			
		scope.addUser = function(user) {
			if (scope.userMultiSelect()) {
				var inArray = false;
				angular.forEach(scope.userModel, function(u) {
					if (u.Id === user.Id) inArray = true;
				});
				if (!inArray) {
					scope.userModel.push(user);
					scope.searchResults = [];
					scope.searchText = "";
					$timeout(function() { input.focus(); }, 0);
				}
			} else {
				scope.userModel["Id"] = user.Id;
				scope.userModel["Title"] = user.Title;
				scope.searchResults = [];
				scope.searchText = "";
				$timeout(function() { input.focus(); }, 0);
			}
		};
		
		scope.$watch("searchText", function(text) {
			if (text) {
				scope.searching = true;
				$sharepoint.getUsersByName(text, scope.userGroup()).then(function(users) {
					scope.searching = false;
					scope.searchResults = users;
				});
			} else {
				scope.searching = false;
				scope.searchResults = [];
			}
		});

    

    }
  };
});

sharepointModule.directive("gridRow", function($compile, $timeout, $sharepoint, $window, $utils) {
  return {
    restrict: "A",
    require: "form",
    scope: {
    	collection: "=gridCollection",
    	item: "=gridRow",
    	gridModel: "&",
    	gridColumns: "&",
    	gridPasteOk: "&",
    	gridAfterPaste: "&",
    	form: "=ngForm",
    	fields: "&gridListFields",
    	allowNew: "&gridAllowNew",
    	validate: "&gridRowValidate"
    },
    link: function(scope, element, attrs, form) {
    	    
    	scope.$watch("form.$valid", function(valid) {
    		if (attrs.gridRowValidate && scope.validate()) scope.item["$valid"] = valid;
    	});
    	
    	// need to watch item.$editing because the 'Add Undocumented Modal' creates and destroys the .sp-field-controls based on whether the commitment is being edited, so the events will not bind if .sp-field-control does not exist
	   	scope.$watchGroup(["item","item.$editing"], function(group) {
	   		var item = group[0];
    		if (item) {
    			$timeout(function() {
    				element.find(".sp-field-control").on("keydown", function(event) {
    					switch (event.which) {
    						case 37:
    							// left
    							var i = $(event.target).closest("td").index();
    							$timeout(function() { element.find("td").eq(i-1).find(".sp-field-control").focus(); }, 0);
    							break;
    						case 38:
    							// up
    							var i = $(event.target).closest("td").index();
    							$timeout(function() { element.prev().find("td").eq(i).find(".sp-field-control").focus(); }, 0);
    							break;
    						case 39:
    							// right
    							var i = $(event.target).closest("td").index();
    							$timeout(function() { element.find("td").eq(i+1).find(".sp-field-control").focus(); }, 0);
    							break;
    						case 40:
    							// down
    							var i = $(event.target).closest("td").index();
    							$timeout(function() { element.next().find("td").eq(i).find(".sp-field-control").focus(); }, 0);
    							break;
    					}
    				}).on("paste", function(event) {
    					if (scope.collection) {
    						event.preventDefault();
    						var i = element.find(".sp-field-control").index(event.target);
    						catchPaste(event, scope.collection.indexOf(scope.item), element.find(".sp-field-control").index(event.target));
    					}
    				});
    			}, 0);
    		}
    	});
    	
    	function catchPaste(event, index, col) {
    		
    		// IE handles the paste event differently
    		var isIE = $utils.detectIE();
    		
    		if (isIE) {
    		
    			var fieldName = $(event.target).attr("name");
    		
    			var rows = window.clipboardData.getData("text").split("\n");
				for (var r = 0; r < rows.length; r++) {
					var cols = rows[r].split("\t");
					rows[r] = cols;
				}
				pasteData(rows, index, col, $(event.target), fieldName);
			
			} else {
			
    			var clipboardItems = event.originalEvent.clipboardData.items;
				var clipboardTypes = event.originalEvent.clipboardData.types;
				var fieldName = $(event.target).attr("name");
				
				for (var i = 0; i < clipboardTypes.length; i++) {
					if (clipboardTypes[i] === "text/plain") {
						clipboardItems[i].getAsString(function(data) {
							var rows = data.split("\n");
							for (var r = 0; r < rows.length; r++) {
								var cols = rows[r].split("\t");
								rows[r] = cols;
							}
							pasteData(rows, index, col, $(event.target), fieldName);
						});
					}
				}
			
			}
		}
		
		function pasteData(rows, row, col, target, fieldName) {
			// add more rows if needed
			var offset = rows.length - (scope.collection.length - row + 1);
			var model = scope.gridModel();
			if (scope.allowNew()) {
				for (var i = 0; i <= offset; i++) {
					scope.collection.push(angular.copy(model));
				}
			}
			var gridColumns = scope.gridColumns();
			if (fieldName) col = gridColumns.indexOf(fieldName);
			for (var i = row, r = 0; r < rows.length; i++, r++) {
				if (!scope.collection[i]) break;
				for (var c = 0; c < rows[r].length; c++) {
					var property = gridColumns[col+c];
					switch (scope.fields()[property].TypeAsString) {
						case "User":
							if (scope.gridPasteOk()) var okPaste = scope.gridPasteOk().call(this, scope.collection[i], property);
							else var okPaste = true;
							if (okPaste) {
								var value = rows[r][c].trim();
								if (value || value === "") {
									scope.collection[i][property]["Title"] = value;
									if (scope.gridAfterPaste()) scope.gridAfterPaste().call(this, scope.collection[i], property);
								}
							}
							break;
						case "Lookup":
							if (scope.gridPasteOk()) var okPaste = scope.gridPasteOk().call(this, scope.collection[i], property);
							else var okPaste = true;
							if (okPaste) {
								var value = rows[r][c].trim();
								if (value || value === "") {
									scope.collection[i][property][field.LookupField] = value;
									if (scope.gridAfterPaste()) scope.gridAfterPaste().call(this, scope.collection[i], property);
								}
							}
							break;
						case "Currency":
							if (scope.gridPasteOk()) var okPaste = scope.gridPasteOk().call(this, scope.collection[i], property);
							else var okPaste = true;
							if (okPaste) {
								var value =  parseFloat(rows[r][c].trim().replace(/[^\d\.]/g,"")).toFixed(2) * 1;
								if (value || value === 0) {
									scope.collection[i][property] = value;
									if (scope.gridAfterPaste()) scope.gridAfterPaste().call(this, scope.collection[i], property);
								}
							}
							break;
						default:
							if (scope.gridPasteOk()) var okPaste = scope.gridPasteOk().call(this, scope.collection[i], property);
							else var okPaste = true;
							if (okPaste) {
								var value = rows[r][c].trim();
								if (value || value === "") {
									scope.collection[i][property] = value;
									if (scope.gridAfterPaste()) scope.gridAfterPaste().call(this, scope.collection[i], property);
								}
							}
					}
				}
			}
			scope.$apply();
		}

    }
  };
});

sharepointModule.directive("spField", function($compile, $timeout, $sharepoint) {
  return {
    restrict: "A",
    templateUrl: "/sites/NikeAccruals/SiteAssets/HTML/partials/sp-field.html",
    scope: {
    	model: "=spModel",
    	field: "&spField",
    	fieldClass: "@spFieldClass",
    	fieldDisabled: "&spFieldDisabled",
    	fieldRequired: "&spFieldRequired",
    	fieldOptions: "&spFieldOptions",
    	modelChange: "&spModelChange",
    	validate: "&spFieldValidate",
    	invalidMessages: "&spFieldInvalidMessages",
    	toggleValidation: "&spFieldShowErrors"
    },
    link: function(scope, element, attrs) {
    
    	// if a custom validation function is set, notify child spField types to run custom validation function
    	if (attrs.spFieldValidate) scope.customValidate = true;
    	else scope.customValidate = false;
    	
    	scope.errorMessage = function(errors) {
    		var message = [];
    		for (error in errors) {
    			switch (error) {
    				case "required": message.push("This is a required field"); break;
    				case "lookup": message.push("Not a valid " + scope.field()["Title"]); break;
    				case "date": message.push("Enter date as mm/dd/yyyy"); break;
    				default: message.push(scope.invalidMessages()[error]);
    			}
    		}
    		return message.join(". ") + ".";
    	};
    	    	
    	element.on("keydown", function(event) {
    		scope.$emit("spFieldKeyPress", event);
    	});
    
    }
  };
});

sharepointModule.directive("spText", function($sharepoint) {
  return {
    restrict: "A",
    require: "ngModel",
    link: function(scope, element, attrs, ngModel) {
    
    	try {
	   		if (scope.field().DefaultValue) scope.ngModel = scope.field().DefaultValue;
	   	} catch(err) {
	   		console.log(err, scope.field);
	   	}
	   	
    }
  };
});

sharepointModule.directive("spChoice", function($sharepoint) {
  return {
    restrict: "A",
    require: "ngModel",
    link: function(scope, element, attrs, ngModelCtrl) {
    	
    	try {
	   		if (scope.field().DefaultValue && !scope.$parent.model) scope.$parent.model = scope.field().DefaultValue;
	   	} catch(err) {
	   		console.log(err, scope.field);
	   	}

    	

    }
  };
});

sharepointModule.directive("spNumber", function($sharepoint, $filter) {
  return {
    restrict: "A",
    require: "ngModel",
    link: function(scope, element, attrs, ngModelCtrl) {
    	
    	var decimals = $(scope.field().SchemaXml).attr("Decimals");
    
    	if (scope.field().DefaultValue && !scope.model) ngModelCtrl.$modelValue = scope.field().DefaultValue;
    	
    	element.on("keypress", function(event) {
			var permitted = [46,48,49,50,51,52,53,54,55,56,57,189];
			if (event.keyCode && _.indexOf(permitted, event.keyCode) == -1) {
				event.preventDefault();
			}
		});
			
		ngModelCtrl.$parsers.unshift(function(text) {
			if (text === "") var number = null;
			else var number = parseFloat(text.replace(/[^\d\.]/g,"")).toFixed(decimals)*1;
			return number;
		});
		
		ngModelCtrl.$formatters.unshift(function(number) {
			var text = $filter("number")(number, decimals);
			return text;
		});
		
		ngModelCtrl.$render = function() {
			element.val(ngModelCtrl.$formatters[0](ngModelCtrl.$modelValue));
		};

		element.on("blur", function() {
			ngModelCtrl.$render();
		});
	
    	
    }
    
  };
});

sharepointModule.directive("spCurrency", function($sharepoint, $filter) {
  return {
    restrict: "A",
    require: "ngModel",
    link: function(scope, element, attrs, ngModelCtrl) {
    
    	if (scope.field().DefaultValue && !scope.ngModel) ngModelCtrl.$modelValue = scope.field().DefaultValue;
    	
    	element.on("keypress", function(event) {
			var permitted = [46,48,49,50,51,52,53,54,55,56,57,189];
			if (event.keyCode && _.indexOf(permitted, event.keyCode) == -1) {
				event.preventDefault();
			}
		});
		
		ngModelCtrl.$parsers.unshift(function(text) {
			if (text === "") var number = null;
			else var number = parseFloat(text.replace(/[^\d\.]/g,"")).toFixed(2)*1;
			return number;
		});
		
		ngModelCtrl.$formatters.unshift(function(number) {
			var text = $filter("currency")(number,"");
			return text;
		});
		
		ngModelCtrl.$render = function() {
			element.val(ngModelCtrl.$formatters[0](ngModelCtrl.$modelValue));
		};

		element.on("blur", function() {
			ngModelCtrl.$render();
		});
    	
    }
    
  };
});

sharepointModule.directive("spLookup", function($sharepoint, $timeout) {
  return {
    restrict: "A",
    require: "ngModel",
    link: function(scope, element, attrs, ngModel) {
    
    	ngModel.$viewChangeListeners.push(function() {
			scope.$eval(attrs.ngChange);
		});
    
    	var input = element.find("input");
    	
    	scope.$watch(function() { return input.outerWidth(); }, function(width) {
    		scope.menuWidth = width;
    	});
    	
    	scope.$watch(function() { return input.outerHeight(); }, function(height) {
    		scope.menuTop = input.position().top + height;
    		scope.menuLeft = input.position().left;
    	});
    	
    	input.on("focus", function() {
    		if (!scope.items) return;
    		else if (scope.items.length > 1) scope.dropdownOpen = true;
    	});
		
    	input.on("blur", function() {
    		$timeout(function() {
    			var elementWithFocus = $(document.activeElement);
    			if (element.find(elementWithFocus).length === 0) scope.dropdownOpen = false;
    		}, 1);
    	});
    	    	
    	input.on("keydown", function(event) {
    		if (event.which === 40 && scope.items.length > 0 && scope.dropdownOpen) {
    			event.stopImmediatePropagation();
				var target = $(event.target).next().find("li a").first();
				$timeout(function() { $(event.target).next().find("li a").first().focus(); }, 0);
			}
    	});
    	
    	function customValidate() {
    		var errors = scope.validate();
	    	for (error in errors) {
	    		ngModel.$setValidity(error, errors[error]);
	    	}
    	}
    	
    	scope.items = [];
    	    	
    	var lookupListGuid = scope.field().LookupList.replace("{","").replace("}","");
    	var lookupField = scope.field().LookupField;
    	
    	// flag to allow silent initialization of value without rest call
    	var initializing = false;
    	scope.$watch("lookupValue", function(lookupValue, previousValue) {
    		if (!scope.model) {
    			//console.log(lookupValue, previousValue);
    			return;
    		}
    		if (typeof lookupValue === "undefined" && typeof previousValue === "undefined") {
    			// initialization
    			if (scope.model.Id) initializing = true;
    			if (scope.model[lookupField]) scope.lookupValue = scope.model[lookupField];
    		}
    		
    		else if (typeof lookupValue === "undefined" && typeof previousValue !== "undefined") {
    			// clear model
    			scope.items = [];
    			scope.model[lookupField] = null;
    			scope.model["Id"] = null;
    			ngModel.$setValidity("lookup", true);
    			if (scope.customValidate) customValidate();
    			scope.$eval(attrs.ngChange);
    			scope.dropdownOpen = false;
    		}
    		else if (initializing) {
    			// if the Id is already set, do not allow search after one-time initialization of lookupValue
    			initializing = false;
    			if (scope.customValidate) customValidate();
    			return;
    		}
    		else {
    			// do search for lookup value
	    		$sharepoint.list(lookupListGuid).getItems({
	    			filter: "substringof('" + lookupValue + "', " + lookupField + ")",
	    			top: 5
	    		}).then(function(items) {
	    			if (scope.lookupValue !== lookupValue) return;
	    			else if (items.length === 1 && items[0][lookupField] === scope.lookupValue) {
	    			    scope.items = items;
	    				scope.model[lookupField] = items[0][lookupField];
	    				scope.model["Id"] = items[0].ID;
						ngModel.$setValidity("lookup", true);
						scope.$eval(attrs.ngChange);
	    				scope.dropdownOpen = false;
	    			}
	    			else if (items.length > 0) {
	    				scope.items = items;
	    				scope.dropdownOpen = true;
	    				scope.model[lookupField] = null;
	    				scope.model["Id"] = null;
	    				ngModel.$setValidity("lookup", false);
	    				scope.$eval(attrs.ngChange);
	    			}
	    			else {
	    				scope.items = [];
	    				scope.dropdownOpen = false;
	    				scope.model[lookupField] = null;
	    				scope.model["Id"] = null;
	    				ngModel.$setValidity("lookup", false);
	    				scope.$eval(attrs.ngChange);
	    			}
	    			if (lookupValue === "") {
	    				ngModel.$setValidity("lookup", true);
	    				 // blank values are ok
	    			}
	    			if (scope.customValidate) customValidate();
	    		});
    		}
    	});
    	
    	scope.selectItem = function(item) {
    		scope.model[lookupField] = item[lookupField];
			scope.model["Id"] = item.ID;
			scope.lookupValue = item[lookupField];
			scope.items = [];
			scope.$eval(attrs.ngChange);
			$timeout(function() { input.focus(); }, 0);
    	};
    	
    	scope.checkItemEvent = function(event, item) {
			if (event.which === 38) {
				if ($(event.target).closest("li").index() === 0) {
					$timeout(function() { input.focus(); }, 0);
				} else $timeout(function() { $(event.target).closest("li").prev().find("a").focus(); }, 0);
			} else if (event.which === 40) {
				$timeout(function() { $(event.target).closest("li").next().find("a").focus(); }, 0);
			} else if (event.which === 13) {
				scope.selectItem(item);
			}
		};
		
    }
  };
});

sharepointModule.directive("spDateTime", function() {
	var date = {
		restrict: "A",
		require: "ngModel",
		link:	function(scope, element, attrs, ngModel) {

			var datepicker = element.datepicker({
				autoclose:	true,
				forceParse: false
			});
			
			ngModel.$validators.date = function(modelValue, viewValue) {
				var value = modelValue || viewValue;
				if (value === null || typeof value === "undefined") var valid = true;
				else var valid = moment(value).isValid();
				return valid;
			};
			
			ngModel.$parsers.push(function(string) {
				var valid = moment(string, "MM/DD/YYYY", true).isValid();
				if (valid) return moment(string, "MM/DD/YYYY", true).toDate();
				else return string;
			});
			
			ngModel.$formatters.unshift(function(date) {
				if (!(date instanceof Date)) return null;
				var mm = ("0" + (date.getMonth() + 1)).slice(-2);
				var dd = ("0" + date.getDate()).slice(-2);
				var yyyy = date.getFullYear();
				var date = mm + "/" + dd + "/" + yyyy;
				return date;
			});
			
			ngModel.$render = function() {
				element.val(ngModel.$formatters[0](ngModel.$modelValue));
				ngModel.$setViewValue(ngModel.$formatters[0](ngModel.$modelValue));
			};
			
		}
	};
	return date;
});

sharepointModule.filter("tableSelect", function() {
	
	function tableSelect(items, filters) {
		if (!filters) return items;
		else {
			var filteredItems = [];
			var remove = [];
			for (var i = 0; i < items.length; i++) {
				var item = items[i];
				for (field in filters) {
				
					var filter = filters[field];
					var filteredItemsIndex = filteredItems.indexOf(item);
					
					var removeIndex = remove.indexOf(item);
					if (removeIndex > -1) continue;
					
					switch (filter.type) {
						case "Note":
						case "Text":
							var regex = new RegExp(filter.value, "i");
							if (regex.test(item[field])) {
								if (filteredItemsIndex === -1) filteredItems.push(item);
								else continue;
							}
							else remove.push(item);
							break;
						case "Currency":
							switch (filter.operator) {
								case "gt":
									if (item[field] > filter.value) {
										if (filteredItemsIndex === -1) filteredItems.push(item);
										else continue;
									}
									else remove.push(item);
									break;
								case "lt":
									if (item[field] < filter.value) {
										if (filteredItemsIndex === -1) filteredItems.push(item);
										else continue;
									}
									else remove.push(item);
									break;
								case "eq":
									if (item[field] === filter.value) {
										if (filteredItemsIndex === -1) filteredItems.push(item);
										else continue;
									}
									else remove.push(item);
									break;
								case "lte":
									if (item[field] <= filter.value) {
										if (filteredItemsIndex === -1) filteredItems.push(item);
										else continue;
									}
									else remove.push(item);
									break;
								case "gte":
									if (item[field] >= filter.value) {
										if (filteredItemsIndex === -1) filteredItems.push(item);
										else continue;
									}
									else remove.push(item);
									break;
							}
							break;
						case "Choice":
							if (filter.value.indexOf(item[field]) > -1) {
								if (filteredItemsIndex === -1) filteredItems.push(item);
								else continue;
							}
							else remove.push(item);
							break;
						case "UserMulti":
						case "User":
							// outstanding build
							if (filteredItemsIndex === -1) filteredItems.push(item);
							break;
						default:
							if (filteredItemsIndex === -1) filteredItems.push(item);
							break;
					}
				}
			}
			// remove items that do not match all filters
			for (var f = filteredItems.length; f >= 0; f--) {
				if (remove.indexOf(filteredItems[f]) > -1) filteredItems.splice(f, 1);
			}
			return filteredItems;
		}
	}
	
	return tableSelect;

});

sharepointModule.directive("fileChooser", function($utils, $timeout) {
  return {
    restrict: 'A',
    scope: true,
    template: "<input type='file' id='file' name='file' class='file-input' /><button class='btn btn-default' ng-click='chooseFile($event)' ng-disabled='processing || unsupported'><i class='fa fa-upload'></i> {{buttonText}}</button>",
    link: function(scope, element, attrs, controllers) {
    
    	var file = element.find("#file");
    	    	 	
    	file.on("click", function(event) {
    		event.stopPropagation();
    	});
    	
    	scope.chooseFile = function() {
    		file.click();
    	};
    	
    	scope.buttonText = attrs.buttonText;
    	
    	element.find("#file").on("change", function(event) {
    		scope.processing = true;
    		readWorkbook(event.currentTarget.files);
    	});
    	
    	scope.processing = false;
    	
    	scope.worksheet = {};
    	
    	if (!window.FileReader) {
    		scope.unsupported = true;
    	}

   		function readWorkbook(files) {
    		for (var i = 0; i < files.length; i++) {
				var reader = new FileReader();
				var name = files[i].name;
				var type = files[i].type;
				reader.onload = function(e) {
					var data = e.target.result;
					// delegate parsing to a web worker
					
					if ($utils.detectIE()) {
						// if IE, do not use a web worker - convert data to binary string
						var d = new Uint8Array(data);
						var arr = new Array();
						for(var i = 0; i < d.length; ++i) {
							arr[i] = String.fromCharCode(d[i]);
						}
						var bstr = arr.join("");
						var workbook = XLSX.read(bstr, {type: "binary"});
						var worksheet = XLS.utils.sheet_to_row_object_array(workbook.Sheets[workbook.SheetNames[0]]);
						console.log(worksheet);
						workbook.Custprops["FileName"] = name;
						fileLoaded(workbook, worksheet);
					}
					else {
						// delegate parsing to a web worker
						var worker = new Worker(_spPageContextInfo.webAbsoluteUrl + "/SiteAssets/JS/workers/readWorkbook.js");
						worker.onmessage = function(e) {
							if (e.data.error) console.log("Error: " + e.data.error);
							else {
								e.data.workbook.Custprops["FileName"] = name;
								fileLoaded(e.data.workbook, e.data.worksheet);
							}
						};
						var msg = {type: type, array: data};
						worker.postMessage(msg, [msg.array]);
					}
			    };
			    reader.readAsArrayBuffer(files[i]);
			}
		
			function fileLoaded(workbook, worksheet) {
				$timeout(function() {
					scope.processing = false;
					scope.$emit("fileLoaded", workbook, worksheet);
					// reset the input
					file.wrap("<form>").parent("form").trigger("reset");
		    		file.unwrap();
	    		}, 0);
	    	}
    	
    	}
    }
  };
});

sharepointModule.directive("tableHeaderFixed", function($window, $timeout) {
  return {
    restrict: 'A',
    scope: {
    	tableHeaderData: "=tableHeaderData"
    },
    link: function(scope, element, attrs, controllers) {
    
    	var clone = element.clone();
    	var table = element.closest("table");
    	
    	clone.css("visibility", "hidden");
    	clone.find("th").css("border", "none");
    	
    	clone.find("th").each(function() {
    		$(this).empty();
    	});
    	
    	element.after(clone);
    	
    	if (attrs.wrapperClass) var wrapperClass = "." + attrs.wrapperClass;
    	else var wrapperClass = "";
    	var wrapper = element.closest("div" + wrapperClass);
    	
    	wrapper.append(element);
    	element.css("position", "absolute");
    	element.css("top", "1px");
    	//element.css("padding-right", "0px");
    	element.css("background", "#FFFFFF");
    	//element.offset({top: wrapper.offset().top + element.outerHeight()});
    	//element.css("top", wrapper.offset().top);

    	sizeColumns();
    	
    	$($window).resize(sizeColumns());
    	
    	scope.$watch("tableHeaderData", function(data) {
    		if (data) sizeColumns();
    	});
    	 	
    	
    	function sizeColumns() {
	    	clone.find("th").each(function(i) {
	    		if (element.find("th").eq(i).find(".table-select-header-text").length === 1) element.find("th").eq(i).find(".table-select-header-text").width($(this).width());
				else element.find("th").eq(i).width($(this).width());
	    	});
	    	//console.log(table.position().top, wrapper.position().top);
	    	wrapper.css("padding-top", element.outerHeight());
    	}
    		
    }
  };
});

sharepointModule.directive("scrollRepeatScrollbar", function($window, $timeout, $animate) {
  return {
    restrict: "C",
    scope: {
    	index: "=scrollRepeatIndex",
    	collection: "&scrollRepeatCollection",
    	limit: "@scrollRepeatLimit"
    },
    link: function(scope, element, attrs, controllers) {
    
    	var scrollbar = element.find(".scroll-repeat-scrollbar-handle");
    	var parent = element.parent();
    	var thead = parent.find("thead");
    	var wrapper = element.closest(".scroll-repeat");
    	
    	var scrolling = false;
    	wrapper.on("wheel", function(event) {
    		//console.log(event);
    		if (scrolling) {
    			// stop the scroll if a scroll is already in progress to prevent jumpiness
    			event.preventDefault();
    			return;
    		}
    		
    		var currentTop = scrollbar.position().top;
    		var maxTop = element.height() - scrollbar.height();
    		var minTop = 0;

    		if (currentTop === 0 && event.originalEvent.deltaY < 0) return;
    		else if (currentTop === maxTop && event.originalEvent.deltaY > 0) return;
    		else event.preventDefault();
			
			// gear the scroll to the page size and collection length - scroll one page at a time
			if (event.originalEvent.deltaY < 0) var deltaY = (parseInt(scope.limit - 1) / collectionLength) * element.height() * -1;
			else {
				var deltaY = (parseInt(scope.limit - 1) / collectionLength) * element.height();
			}
			
    		var newTop = currentTop + deltaY;
    		
    		if (newTop < minTop) var animateTop = minTop;
    		else if (newTop > maxTop) var animateTop = maxTop;
    		else var animateTop = newTop;
    		
    		scrollbar.animate({"top": animateTop}, {
    			duration: 500,
    			easing: "easeOutExpo",
    			start: function() {
    				scrolling = true;
    			},
    			step: function(top) {
    				watchDrag();
    			},
    			complete: function() {
    				scrolling = false;
    			}
    		});
    		
    	});
    	
    	var collectionLength = 0;
    	scope.$watch("collection().length", function(len) {
    		scrollbar.css("visibility", "hidden");
    		if (len) {
    			collectionLength = len;
    			scope.refreshScrollbar();
    		}
    	});
    	    	    	
    	scope.refreshScrollbar = function() {
    		$timeout(function() {
    			margin = element.parent().find("thead").height();
    			height = element.parent().find("tbody").height();
    			element.css({"height": height, "margin-top": margin});
    			heightSet = true;
    		}, (attrs.scrollRepeatDelay || 0));
    		//collectionLength = scope.collection().length;
    		//var len = collectionLength;
    		var heightRatio = scope.limit / collectionLength * 100;
    		if (heightRatio > 100) heightRatio = 100;
    		else if (heightRatio < 5) heightRatio = 5;
    		scrollbar.css("height", heightRatio + "%");
    		if (heightRatio === 100) {
    			scrollbar.css("visibility", "hidden");
    		} else scrollbar.css("visibility", "visible");
    		scrollbar.css("top", 0);
    		scope.index = 0;
    	};
    	
    	// allow update of scrollbar via events
    	scope.$on("refreshScrollbar", function() {
    		scope.refreshScrollbar();
    	});
    	
    	scrollbar.draggable({
    		axis: "y",
    		containment: "parent",
    		drag: function() {
    			watchDrag();
    		}
    	});

    	function watchDrag() {
    		//console.log(parent.height());
    		var top = scrollbar.position().top;
    		if (top < 0) top = 0;
    		var scrollRatio = top / (element.height() - scrollbar.height());
    		//var index = Math.round(scrollRatio * scope.collection().length);
    		
    		var index = Math.round(scrollRatio * (scope.collection().length - scope.limit));
    		//console.log(scrollRatio, index);
    		scope.$apply(function() {
    			scope.index = index;
    		});
    	}
    	
    		
    }
  };
});


sharepointModule.filter("sliceScroll", function() {
	
	function sliceScroll(items, limit, startIndex) {
		if (!items) return;
		var filteredItems = [];
		if (!startIndex) var startIndex = 0;
		for (var i = startIndex; i < startIndex + limit && i < items.length; i++) {
			//if (items[i].hover) items[i].hover = false;
			//else if (items[i].$hover) items[i].$hover = false;
			filteredItems.push(items[i]);
		}
		
		return filteredItems;
	}
	
	return sliceScroll;

});

/*

JOIN QUERY VIEW XML EXAMPLE:

				var viewXml = "<View>"
				+			"<Joins>"
				+				"<Join Type='LEFT' ListAlias='costcenters'>"
				+					"<Eq>"
				+						"<FieldRef Name='CostCenter' RefType='Id' />"
				+						"<FieldRef List='costcenters' Name='ID' />"
				+					"</Eq>"
				+				"</Join>"
				+			"</Joins>"
				+			"<ProjectedFields>"
				+				"<Field Name='CmtCostCenter' ShowField='CostCenter' Type='Lookup' List='costcenters' />"
				+			"</ProjectedFields>"
				+			"<ViewFields>"
  				+				"<FieldRef Name='CmtCostCenter' />"
  				+				"<FieldRef Name='Description' />"
				+			"</ViewFields>"
				+			"<Query>"
				+				"<Where>"
				+					"<And>"
				+						"<Eq>"
				+							"<FieldRef Name='Period' LookupId='TRUE' />"
				+							"<Value Type='Lookup'>" + $scope.period.ID + "</Value>"
				+						"</Eq>"
				+						"<In>"
				+							"<FieldRef Name='CostCenter' LookupId='TRUE' />"
				+							"<Values>" + costCenterFilters.join("") + "</Values>"
				+						"</In>"
				+					"</And>"
				+				"</Where>"
				+			"</Query>"
				+		"</View>";

*/
