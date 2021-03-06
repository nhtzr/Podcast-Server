class podcastStatsDirective {
    constructor() {
        this.restrict = 'E';
        this.scope = { podcast : '='};
        this.templateUrl = 'html/podcast-details-stats.html';
        this.controller = 'PodcastDetailsStatsCtrl';
        this.controllerAs = 'pdsc';
        this.bindToController = true;
    }
}

class PodcastDetailsStatsCtrl {

    constructor($scope, $q, podcastService) {
        this.$q = $q;
        this.podcastService = podcastService;
        this.month = 6;

        this.chartSeries = [];
        this.generateChartData();
        this.chartConfig = {
            options: {
                chart: {
                    type: 'spline'
                },
                plotOptions: {
                    spline: {
                        marker: {
                            enabled: true
                        }
                    }
                },
                xAxis: {
                    type: 'datetime',
                    dateTimeLabelFormats: { // don't display the dummy year
                        month: '%e. %b',
                        year: '%b'
                    },
                    title: {
                        text: 'Date'
                    }
                }
            },
            series: this.chartSeries,
            title : {
                text : ''
            },
            credits: {
                enabled: false
            },
            loading: false
        };

        $scope.$on("podcastItems:refresh", () => this.generateChartData());
    }

    navigate(offset) {
        this.month += offset;
        return this.generateChartData();
    }

    generateChartData() {
        PodcastDetailsStatsCtrl.resetChart(this.chartSeries);

        return this.$q.all([
            this.podcastService.statsByByDownloaddate(this.podcast.id, this.month),
            this.podcastService.statsByPubdate(this.podcast.id, this.month)
        ]).then((arrayResult) => {
            let downloadData = _(arrayResult[0])
                    .map(PodcastDetailsStatsCtrl.dateMapper())
                    .sortBy("date")
                    .map(PodcastDetailsStatsCtrl.highChartsMapper())
                    .value(),
                publicationData = _(arrayResult[1])
                    .map(PodcastDetailsStatsCtrl.dateMapper())
                    .sortBy("date")
                    .map(PodcastDetailsStatsCtrl.highChartsMapper())
                    .value();

            this.chartSeries.push({"name": "Download Date", "data": downloadData});
            this.chartSeries.push({"name": "Publication Date", "data": publicationData});
            return this.chartSeries;
        });
    }

    static resetChart(chartSeries) {
        _.updateinplace(chartSeries, []);
    }

    static dateMapper() {
        return (value) => { return { date : Date.UTC(value.date[0], value.date[1]-1, value.date[2]), numberOfItems : value.numberOfItems }; };
    }

    static highChartsMapper() {
        return (value) => [value.date, value.numberOfItems];
    }
}


angular.module('ps.podcast.details.stats', [ 'highcharts-ng' ])
    .directive('podcastStats', () => new podcastStatsDirective())
    .controller('PodcastDetailsStatsCtrl', PodcastDetailsStatsCtrl);