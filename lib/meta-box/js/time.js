( function ( $, swpmb, i18n ) {
	'use strict';

	/**
	 * Transform an input into a time picker.
	 */
	function transform() {
		let $this = $( this ),
			options = $this.data( 'options' ),
			current = $this.val();
		current = formatTime( current );

		$this.siblings( '.ui-datepicker-append' ).remove();  // Remove appended text

		options.onSelect = function () {
			$this.trigger( 'change' );
		};
		options.beforeShow = function ( i ) {
			if ( $( i ).prop( 'readonly' ) ) {
				return false;
			}
		};

		let $inline = $this.siblings( '.swpmb-datetime-inline' );
		if ( !$inline.length ) {
			$inline = $this.closest( '.swpmb-input-group' ).siblings( '.swpmb-datetime-inline' );
		}
		if ( !$inline.length ) {
			$this.removeClass( 'hasDatepicker' ).timepicker( options ).timepicker( 'setTime', current );
			return;
		}

		options.altField = '#' + $this.attr( 'id' );
		$inline
			.removeClass( 'hasDatepicker' )
			.empty()
			.prop( 'id', '' )
			.timepicker( options )
			.timepicker( 'setTime', current );
	}

	const formatTime = time => {
		if ( !time.includes( ':' ) ) {
			return time;
		}
		let [ hours, minutes ] = time.split( ':' );
		hours = hours.padStart( 2, '0' );
		minutes = minutes.padStart( 2, '0' );

		return `${ hours }:${ minutes }`;
	};

	// Set language if available
	function setTimeI18n() {
		if ( $.timepicker.regional.hasOwnProperty( i18n.locale ) ) {
			$.timepicker.setDefaults( $.timepicker.regional[ i18n.locale ] );
		} else if ( $.timepicker.regional.hasOwnProperty( i18n.localeShort ) ) {
			$.timepicker.setDefaults( $.timepicker.regional[ i18n.localeShort ] );
		}
	}

	function init( e ) {
		$( e.target ).find( '.swpmb-time' ).each( transform );
	}

	setTimeI18n();
	swpmb.$document
		.on( 'mb_ready', init )
		.on( 'clone', '.swpmb-time', transform );
} )( jQuery, swpmb, SWPMB_Time );
