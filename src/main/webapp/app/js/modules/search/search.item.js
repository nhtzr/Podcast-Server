angular.module('ps.search.item', [
    'ps.dataService.donwloadManager',
    'ps.dataService.item',
    'ps.dataService.tag',
    'ps.player',
    'ps.config.route',
    'ngTagsInput'
])
    .config(function($routeProvider, commonKey) {
        $routeProvider.
            when('/items', {
                templateUrl: 'html/items-search.html',
                controller: 'ItemsSearchCtrl',
                reloadOnSearch: false,
                hotkeys: [
                    ['right', 'Next page', 'currentPage = currentPage+1; changePage();'],
                    ['left', 'Previous page', 'currentPage = currentPage-1; changePage();']
                ].concat(commonKey)
            });
    })
    .constant('ItemPerPage', 12)
    .controller('ItemsSearchCtrl', function ($scope, $cacheFactory, $location, itemService, tagService, DonwloadManager, ItemPerPage, playlistService) {
        'use strict';

        // Gestion du cache de la pagination :
        var cache = $cacheFactory.get('paginationCache') || $cacheFactory('paginationCache');

        $scope.changePage = function() {
            $scope.searchParameters.page = ($scope.currentPage <= 1) ? 1 : ($scope.currentPage > Math.ceil($scope.totalItems / ItemPerPage)) ? Math.ceil($scope.totalItems / ItemPerPage) : $scope.currentPage;
            $scope.searchParameters.page -= 1;
            itemService.search($scope.searchParameters).then(function(itemsResponse) {

                $scope.items = itemsResponse.content;
                $scope.totalPages = itemsResponse.totalPages;
                $scope.totalItems = itemsResponse.totalElements;

                cache.put('search:currentPage', $scope.currentPage);
                cache.put('search:currentWord', $scope.term);
                cache.put('search:currentTags', $scope.searchTags);
                cache.put("search:direction", $scope.direction);
                cache.put("search:properties", $scope.properties);

                $location.search("page", $scope.currentPage);
            });
        };

        $scope.$on('$routeUpdate', function(){
            if ($scope.currentPage !== $location.search().page) {
                $scope.currentPage = $location.search().page || 1;
                $scope.changePage();
            }
        });

        $scope.swipePage = function(val) {
            $scope.currentPage += val;
            $scope.changePage();
        };

        //** Item Operation **//
        $scope.remove = function (item) {
            return item.remove().then(function(){
                playlistService.remove(item);
                return $scope.changePage();
            });
        };

        $scope.reset = function (item) {
            return item.reset().then(function (itemReseted) {
                var itemInList = _.find($scope.items, { 'id': itemReseted.id });
                _.assign(itemInList, itemReseted);
                playlistService.remove(itemInList);
            });
        };

        // Longeur inconnu au chargement :
        //{term : 'term', tags : $scope.searchTags, size: numberByPage, page : $scope.currentPage - 1, direction : $scope.direction, properties : $scope.properties}
        $scope.totalItems = Number.MAX_VALUE;
        $scope.maxSize = 10;

        $scope.searchParameters = {};
        $scope.searchParameters.size = ItemPerPage;
        $scope.currentPage = cache.get("search:currentPage") || 1;
        $scope.searchParameters.term = cache.get("search:currentWord") || undefined;
        $scope.searchParameters.searchTags = cache.get("search:currentTags") || undefined;
        $scope.searchParameters.direction = cache.get("search:direction") || undefined;
        $scope.searchParameters.properties = cache.get("search:properties") || undefined;

        $scope.changePage();

        //** DownloadManager **//
        $scope.stopDownload = DonwloadManager.ws.stop;
        $scope.toggleDownload = DonwloadManager.ws.toggle;
        $scope.loadTags = tagService.search;

        //** Playlist Manager **//
        $scope.addOrRemove = function(item) {
            return playlistService.addOrRemove(item);
        };
        $scope.isInPlaylist = function(item) {
            return playlistService.contains(item);
        };

        //** WebSocket Subscription **//
        var webSocketUrl = "/topic/download";
        DonwloadManager
            .ws
            .subscribe(webSocketUrl, function updateItemFromWS(message) {
                var item = JSON.parse(message.body);

                var elemToUpdate = _.find($scope.items, { 'id': item.id });
                if (elemToUpdate)
                    _.assign(elemToUpdate, item);
            }, $scope);
    });