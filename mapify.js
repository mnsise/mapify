;(function($, window, document, undefined) {

    "use strict";

    var pluginName = "mapify",
        defaults = {
            // The following plugin options can be overridden
            // by their data attribute counterparts.
            // This way you can set defaults for multiple maps
            // and override specific options per map.
            markers: [], //=> a selector or array of marker objects
            lat: null,
            lng: null,
            centerLat: null,
            centerLng: null,

            // Map zoom level...
            // 1: World
            // 5: Landmass/continent
            // 10: City
            // 15: Streets
            // 20: Buildings
            zoom: 10,
            scrollwheel: false, //=> zoom with the mouse scrollwheel

            icon: null, //=> a "data-icon" on a marker will override any default icon
            iconSize: null, //=> optional
            iconOrigin: null, //=> optional
            iconAnchor: null, //=> optional

            // The following callbacks are available...
            // The map and marker parameters are the Google Map and Marker objects.
            // You can access the related .map and .marker DOM elements as jQuery objects
            // via the property map.$map and marker.$marker
            onMapClick:               function (map, event) { },
            onMarkerClick:            function (marker, map, event) { },
            onMarkerMouseEnter:       function (marker, map, event) { },
            onMarkerMouseLeave:       function (marker, map, event) { },
            onMarkerLegendClick:      function (marker, map, event) { },
            onMarkerLegendMouseEnter: function (marker, map, event) { },
            onMarkerLegendMouseLeave: function (marker, map, event) { }
        };

    function Plugin (mapContainer, options) {
        // The map element
        this.mapContainer = mapContainer;
        this.$map = $(mapContainer);

        // Merge map options and data attributes
        this.options = $.extend({}, defaults, options, this.getMapDataAttributes());

        this.map = null; //=> Google Map object
        this.markers = []; //=> Google Marker objects

        this.init();
    }

    $.extend(Plugin.prototype, {

        init: function () {
            this.createMap();
            this.createMarkers();
            this.centerMap();
        },

        createMap: function () {
            this.map = new google.maps.Map(this.mapContainer, this.normalizeMapOptions());
            this.map.addListener('click', this.onMapClick.bind(this));
            this.map.$map = this.$map;
            this.$map.data('map', this.map);
        },

        createMarkers: function () {
            var normalizedMarkers = this.normalizeMarkers();

            $.each(normalizedMarkers, function (index, markerOptions) {
                this.createMarker(markerOptions);
            }.bind(this));

            if (this.isUsingMarkerElements()) {
                $(document)
                    .on('click',      this.options.markers, this.onMarkerLegendClick.bind(this))
                    .on('mouseenter', this.options.markers, this.onMarkerLegendMouseEnter.bind(this))
                    .on('mouseleave', this.options.markers, this.onMarkerLegendMouseLeave.bind(this));
            }
        },

        createMarker: function (markerOptions) {
            var marker = new google.maps.Marker(markerOptions);
            this.markers.push(marker);

            if (this.isUsingMarkerElements()) {
                markerOptions.$marker.data('marker', marker);
            }

            if (markerOptions.center === true) {
                this.setMarkerAsCenter(markerOptions);
            }

            marker.addListener('click',     function(event) { this.onMarkerClick(marker, event);      }.bind(this));
            marker.addListener('mouseover', function(event) { this.onMarkerMouseEnter(marker, event); }.bind(this));
            marker.addListener('mouseout',  function(event) { this.onMarkerMouseLeave(marker, event); }.bind(this));
        },

        centerMap: function () {
            // If there is no center point yet, use the first marker.
            if ( ! this.options.centerLat || ! this.options.centerLng) {
                if (this.markers.length === 0) {
                    console.error('Could not set a center position on the map.');
                }

                this.setMarkerAsCenter(this.markers[0]);
            }

            this.map.setCenter(
                this.createLatLng(this.options.centerLat, this.options.centerLng)
            );
        },

        setMarkerAsCenter: function (marker) {
            this.options.centerLat = marker.position.lat();
            this.options.centerLng = marker.position.lng();
        },

        //
        // Normalize Marker & Map Options
        //

        normalizeMarkers: function () {
            if (this.mapHasSingleMarkerCoords()) {
                return [this.normalizeMarkerElement(this.$map)];
            }

            if (this.isUsingMarkerElements()) {
                return this.normalizeMarkerElements();
            }

            return this.normalizeMarkerObjects();
        },

        normalizeMarkerObjects: function () {
            var markers = [];

            $.each(this.options.markers || [], function (index, marker) {
                markers.push(this.normalizeMarkerObject(marker));
            }.bind(this));

            return markers;
        },

        normalizeMarkerElements: function () {
            var markers = [];

            $(this.options.markers).each(function (index, marker) {
                markers.push(this.normalizeMarkerElement($(marker)));
            }.bind(this));

            return markers;
        },

        normalizeMarkerObject: function (marker) {
            return this.removeEmptyObjectProperties({
                position: this.createLatLng(marker.lat, marker.lng),
                center: marker.center,
                icon: this.normalizeIcon(marker),
                label: marker.label,
                title: marker.title,
                map: this.map
            });
        },

        normalizeMarkerElement: function ($marker) {
            return this.removeEmptyObjectProperties({
                position: this.createLatLng($marker.data('lat'), $marker.data('lng')),
                center: $marker.data('center'),
                icon: this.normalizeIcon($marker),
                label: $marker.data('label'),
                title: $marker.data('title'),
                map: this.map,
                $marker: $marker
            });
        },

        normalizeIcon: function (source) {
            var icon = this.removeEmptyObjectProperties({
                url:                         source.icon       || source.data('icon')        || this.options.icon,
                scaledSize: this.createSize( source.iconSize   || source.data('icon-size')   || this.options.iconSize),
                origin:     this.createPoint(source.iconOrigin || source.data('icon-origin') || this.options.iconOrigin),
                anchor:     this.createPoint(source.iconAnchor || source.data('icon-anchor') || this.options.iconAnchor)
            });

            return icon.url ? icon : null;
        },

        normalizeMapOptions: function () {
            return this.removeEmptyObjectProperties({
                zoom: this.options.zoom,
                scrollwheel: this.options.scrollwheel
            });
        },

        //
        // Map Data Attributes
        //

        getMapDataAttributes: function () {
            return this.removeEmptyObjectProperties({
                markers: this.$map.data('markers'),
                zoom: this.$map.data('zoom'),
                scrollwheel: this.$map.data('scrollwheel'),
                lat: this.$map.data('lat'),
                lng: this.$map.data('lng'),
                centerLat: this.$map.data('center-lat') || this.$map.data('lat'),
                centerLng: this.$map.data('center-lng') || this.$map.data('lng'),
                icon: this.$map.data('icon'),
                iconSize: this.$map.data('icon-size'),
                iconOrigin: this.$map.data('icon-origin'),
                iconAnchor: this.$map.data('icon-anchor')
            });
        },

        //
        // Google Factory
        //

        createLatLng: function (lat, lng) {
            return new google.maps.LatLng(lat, lng);
        },

        createSize: function (size) {
            size = this.splitValues(size);

            return size ? new google.maps.Size(size.x, size.y) : null;
        },

        createPoint: function (point) {
            point = this.splitValues(point);

            return point ? new google.maps.Point(point.x, point.y) : null;
        },

        //
        // General Helpers
        //

        mapHasSingleMarkerCoords: function () {
            return this.options.lat && this.options.lng;
        },

        isUsingMarkerElements: function () {
            return this.isString(this.options.markers);
        },

        isString: function (value) {
            return typeof value === 'string' || value instanceof String;
        },

        splitValues: function (values) {
            if ( ! values) {
                return null;
            }

            values = values.split(',');

            return {
                x: values[0],
                y: values[1]
            };
        },

        removeEmptyObjectProperties: function (obj) {
            for (var propName in obj) {
                if (obj[propName] === null || obj[propName] === undefined) {
                    delete obj[propName];
                }
            }

            return obj;
        },

        //
        // Events & Callbacks
        //

        onMapClick: function (event) {
            this.runUserCallback(this.options.onMapClick, this.map, event);
        },

        onMarkerClick: function (marker, event) {
            this.runUserCallback(this.options.onMarkerClick, marker, this.map, event);
        },

        onMarkerMouseEnter: function (marker, event) {
            this.runUserCallback(this.options.onMarkerMouseEnter, marker, this.map, event);
        },

        onMarkerMouseLeave: function (marker, event) {
            this.runUserCallback(this.options.onMarkerMouseLeave, marker, this.map, event);
        },

        onMarkerLegendClick: function (event) {
            var marker = $(event.currentTarget).data('marker');
            this.runUserCallback(this.options.onMarkerLegendClick, marker, this.map, event);
        },

        onMarkerLegendMouseEnter: function (event) {
            var marker = $(event.currentTarget).data('marker');
            this.runUserCallback(this.options.onMarkerLegendMouseEnter, marker, this.map, event);
        },

        onMarkerLegendMouseLeave: function (event) {
            var marker = $(event.currentTarget).data('marker');
            this.runUserCallback(this.options.onMarkerLegendMouseLeave, marker, this.map, event);
        },

        runUserCallback: function (callback) {
            if (callback instanceof Function) {
                callback.apply(this, Array.prototype.slice.call(arguments, 1));
            }
        }

    });

    $.fn[ pluginName ] = function (options) {
        return this.each(function () {
            if ( ! $.data(this, "plugin_" + pluginName)) {
                $.data(this, "plugin_" + pluginName, new Plugin(this, options));
            }
        });
    };

})(jQuery, window, document);
