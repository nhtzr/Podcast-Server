/**
 * Created by kevin on 01/11/14.
 */

class itemService {
    constructor(Restangular) {
        this.Restangular = Restangular;
        this.childRoute = "items";
    }

    search(searchParameters = { page : 0, size : 12} ) {
        return this.Restangular.one("item/search")
            .post(null, searchParameters)
            .then((responseFromServer) => {
                responseFromServer.content = this.restangularizedItems(responseFromServer.content);
                return responseFromServer;
            });
    }

    findById(podcastId, itemId) {
        return this.Restangular.one("podcast", podcastId).one(this.childRoute, itemId).get();
    }

    getItemForPodcastWithPagination(podcast, pageParemeters) {
        return podcast.one("items").post(null, pageParemeters);
    }

    restangularizePodcastItem (podcast, items) {
        return this.Restangular.restangularizeCollection(podcast, items, this.childRoute);
    }

    restangularizedItems(itemList) {
        var restangularList = [];
        
        angular.forEach(itemList, (value) => {
            restangularList.push(this.Restangular.restangularizeElement(this.Restangular.one('podcast', value.podcastId), value, this.childRoute));
        });
        return restangularList;
    }

    upload(podcast, file) {
        var formData = new FormData();
        formData.append('file', file);
        return podcast.all(this.childRoute)
            .withHttpConfig({transformRequest: angular.identity})
            .customPOST(formData, 'upload', undefined, {'Content-Type': undefined});
    }
}

angular.module('ps.dataService.item', ['restangular']).service('itemService', itemService);
