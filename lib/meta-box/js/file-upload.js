( function ( $, wp, swpmb ) {
	'use strict';

	var views = swpmb.views = swpmb.views || {},
		MediaField = views.MediaField,
		FileUploadField, UploadButton;

	FileUploadField = views.FileUploadField = MediaField.extend( {
		createAddButton: function () {
			this.addButton = new UploadButton( { controller: this.controller } );
		}
	} );

	UploadButton = views.UploadButton = Backbone.View.extend( {
		className: 'swpmb-upload-area',
		tagName: 'div',
		template: wp.template( 'swpmb-upload-area' ),
		render: function () {
			this.$el.html( this.template( {} ) );
			return this;
		},

		initialize: function ( options ) {
			this.controller = options.controller;
			this.el.id = _.uniqueId( 'swpmb-upload-area-' );
			this.render();

			// Auto hide if you reach the max number of media
			this.listenTo( this.controller, 'change:full', function () {
				this.$el.toggle( !this.controller.get( 'full' ) );
			} );

			this.collection = this.controller.get( 'items' );
			this.listenTo( this.collection, 'remove', function ( item ) {
				if ( item.get( 'file' ) !== undefined ) {
					this.uploader.uploader.removeFile( item.get( 'file' ) );
				}
				const totalFiles = parseInt( this.uploader.uploader.getOption( 'totalFiles' ) );
				this.uploader.uploader.setOption( 'totalFiles', totalFiles - 1 );
			} );
		},

		// Initializes plupload using code from wp.Uploader (wp-includes/js/plupload/wp-plupload.js)
		initUploader: function ( $this ) {
			var self = this,
				$input = $this.closest( '.swpmb-input' ),
				$process = $input.find( '.swpmb-media-view .swpmb-media-progress' ),
				extensions = this.getExtensions().join( ',' ),
				maxFileSize = this.controller.get( 'maxFileSize' ),
				maxFiles = parseInt( this.controller.get( 'maxFiles' ) ),
				options = {
					container: this.el,
					dropzone: this.el,
					browser: this.$( '.swpmb-browse-button' ),
					params: {
						post_id: $( '#post_ID' ).val()
					},
					added: function ( attachment ) {
						self.controller.get( 'items' ).add( [ attachment ] );
					}
				};

			// Initialize the plupload instance.
			this.uploader = new wp.Uploader( options );

			var filters = this.uploader.uploader.getOption( 'filters' );
			if ( maxFileSize ) {
				filters.max_file_size = maxFileSize;
			}
			if ( extensions ) {
				filters.mime_types = [ { title: i18nRwmbMedia.select, extensions: extensions } ];
			}
			this.uploader.uploader.setOption( 'filters', filters );
			this.uploader.uploader.setOption( 'totalFiles', 0 );

			this.uploader.uploader.bind( 'FilesAdded', function ( up, files ) {
				const that = this,
					totalFiles = parseInt( that.getOption( 'totalFiles' ) );

				$.each( files, function ( i, file ) {
					if ( maxFiles !== 0 && i >= maxFiles - totalFiles ) {
						up.removeFile( files[ i ] );
						return;
					}

					$process.append( `<div id="${ file.id }" class="swpmb-progress" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
						${ file.name } - ${ file.percent } %
					</div>` );
					that.setOption( 'totalFiles', parseInt( that.getOption( 'totalFiles' ) ) + 1 );
				} );
			} );

			const setWidth = ( file, value ) => $process.find( `#${ file.id }` ).attr( 'aria-valuenow', value ).css( '--value', value ).text( `${ file.name } - ${ value }%` );

			this.uploader.uploader.bind( 'UploadProgress', ( up, file ) => setWidth( file, file.percent ).addClass( file.percent === 100 ? 'swpmb-progress--completed' : '' ) );
			this.uploader.uploader.bind( 'FileUploaded', ( up, file ) => $process.find( `#${ file.id }` ).fadeOut( 'slow', function () {
				$( this ).remove();
			} ) );

			this.uploader.uploader.bind( 'Error', function ( up, err ) {

				if ( $input.find( '.swpmb-error' ).length === 0 ) {
					$input.append( '<p class="swpmb-error"></p>' );
				}

				const $error = $input.find( '.swpmb-error' ).empty().show();
				$error.text( err.message );
				setTimeout( function () {
					$error.fadeOut( "slow" );
				}, 5000 );
			} );

			$this.data( 'uploader', this.uploader );
		},

		getExtensions: function () {
			var mimeTypes = this.controller.get( 'mimeType' ).split( ',' ),
				exts = [];

			_.each( mimeTypes, function ( current, index ) {
				if ( i18nRwmbMedia.extensions[ current ] ) {
					exts = exts.concat( i18nRwmbMedia.extensions[ current ] );
				}
			} );
			return exts;
		}
	} );

	function initFileUpload() {
		var $this = $( this ),
			view = $this.data( 'view' );

		if ( view ) {
			return;
		}
		view = new FileUploadField( { input: this } );

		$this.siblings( '.swpmb-media-view' ).remove();
		$this.after( view.el );
		// Init progress
		view.$el.find( '.swpmb-media-list' ).after( '<div class="swpmb-media-progress"></div>' );
		// Init uploader after view is inserted to make wp.Uploader works.
		view.addButton.initUploader( $this );

		$this.data( 'view', view );
	}

	function init( e ) {
		$( e.target ).find( '.swpmb-file_upload' ).each( initFileUpload );
	}

	function removeFile( e ) {
		$( '.swpmb-media-progress #' + $( this ).data( 'file_id' ) ).remove();
	}

	swpmb.$document
		.on( 'mb_ready', init )
		.on( 'clone', '.swpmb-file_upload', initFileUpload )
		.on( 'click', '.swpmb-file-actions .swpmb-remove-media', removeFile );
} )( jQuery, wp, swpmb );
