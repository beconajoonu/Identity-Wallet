'use strict';

function SkCirclePieChartDirective($timeout) {
    'ngInject';

    return {
        restrict: 'E',
        scope: {
            data: '='
        },
        link: (scope, element) => {

            let chunk = function (arr, chunk) {
                let result = [];
                let i, j;
                for (i = 0, j = arr.length; i < j; i += chunk) {
                    result.push(arr.slice(i, i + chunk));
                }
                return result;
            };

            let getUniqueIdentifier = (item, index) => {
                return `${item.title + index}`;
            }

            scope.chunkedItems = chunk(scope.data.items, 3);

            google.charts.load("current", { packages: ["corechart"] });
            google.charts.setOnLoadCallback(() => {
                if (scope.data.callback && scope.data.callback.onReady) {
                    scope.data.callback.onReady();
                }
            });

            function drawChart() {
                let container = document.getElementById('chart');
                
                if (!container) return;

                let dataItems = [];
                let colors = [];
                scope.data.items.forEach((item, index) => {
                    item.uniqueIdentifier = getUniqueIdentifier(item, index);
                    dataItems.push([item.title, item.valueUSD]);
                    colors.push(item.color);
                });

                let processedData = [['Content', 'percents']].concat(dataItems);
                let data = google.visualization.arrayToDataTable(processedData);

                let options = {
                    backgroundColor: 'transparent',
                    title: "",
                    chartArea: { left: 15, top: 15, bottom: 15, right: 15 },
                    pieHole: 0.7,
                    pieSliceBorderColor: 'none',
                    colors: colors,
                    legend: {
                        position: 'none'
                    },
                    pieSliceText: 'none',
                    tooltip: {
                        trigger: 'none'
                    },
                    animation: {
                        duration: 4500,
                        startup: true
                    }
                };

                let chart = new google.visualization.PieChart(container);

                scope.chartIsReady = false;
                
                google.visualization.events.addListener(chart, 'ready', function (chartItem) {
                    scope.chartIsReady = true;
                    scope.$apply();
                });

                chart.draw(data, options);

                let addOrRemoveActive = (chartItem, fn) => {
                    let index = chartItem.row;
                    let uniqueIdentifier = getUniqueIdentifier(scope.data.items[index], index);
                    let el = document.getElementsByName(uniqueIdentifier)[0];
                    let angularEl = angular.element(el);
                    angularEl[fn]('active');
                };

                google.visualization.events.addListener(chart, 'onmouseover', function (chartItem) {
                    let sel = chart.getSelection();
                    if (sel && sel.length && sel[0].row == chartItem.row) {
                        addOrRemoveActive(chartItem, 'removeClass');
                        $timeout(() => {
                            addOrRemoveActive(chartItem, 'addClass');
                        }, 100);
                        return;
                    }
                    addOrRemoveActive(chartItem, 'addClass');
                });


                google.visualization.events.addListener(chart, 'onmouseout', function (chartItem) {
                    let sel = chart.getSelection();
                    if (sel && sel.length && sel[0].row == chartItem.row) {
                        return;
                    }
                    addOrRemoveActive(chartItem, 'removeClass');
                });

                google.visualization.events.addListener(chart, 'select', function (chartItem) {
                    let sel = chart.getSelection();
                    if (!sel || !sel[0]) {
                        return;
                    }

                    scope.data.items.forEach((item, index) => {
                        if (index != sel[0].row) {
                            addOrRemoveActive({ row: index }, 'removeClass');
                        } else {
                            if (scope.data.callback && scope.data.callback.onItemClick) {
                                scope.data.callback.onItemClick(item);
                            }
                        }
                    });
                });
            }

            scope.data.draw = () => {
                $timeout(() => {
                    scope.chunkedItems = chunk(scope.data.items, 3);
                    drawChart();
                }, 400);
            }

        },
        replace: true,
        templateUrl: 'common/directives/sk-circle-pie-chart.html'
    }
}

module.exports = SkCirclePieChartDirective;

