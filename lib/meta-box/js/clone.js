( function ( $, swpmb ) {
	'use strict';

	// Object holds all methods related to fields' index when clone
	var cloneIndex = {
		/**
		 * Set index for fields in a .swpmb-clone
		 * @param $inputs .swpmb-clone element
		 * @param index Index value
		 */
		set: function ( $inputs, index, count ) {
			$inputs.each( function () {
				var $field = $( this );

				// Name attribute
				var name = this.name;
				if ( name && ! $field.closest( '.swpmb-group-clone' ).length ) {
					$field.attr( 'name', cloneIndex.replace( index, name, '[', ']', false ) );
				}

				// ID attribute
				var id = this.id;
				if ( id ) {
					id = id.replace( '_swpmb_template', '' );

					// First clone takes the original ID
					if ( count === 2 ) {
						$field.attr( 'id', id );
					}

					if ( count > 2 ) {
						$field.attr( 'id', cloneIndex.replace( index, id, '_', '', true, true ) );
					}
				}

				$field.trigger( 'update_index', index );
			} );
		},

		/**
		 * Replace an attribute of a field with updated index
		 * @param index New index value
		 * @param value Attribute value
		 * @param before String before returned value
		 * @param after String after returned value
		 * @param alternative Check if attribute does not contain any integer, will reset the attribute?
		 * @param isEnd Check if we find string at the end?
		 * @return string
		 */
		replace: function ( index, value, before, after, alternative, isEnd ) {
			before = before || '';
			after = after || '';

			if ( typeof alternative === 'undefined' ) {
				alternative = true;
			}

			var end = isEnd ? '$' : '';

			var regex = new RegExp( cloneIndex.escapeRegex( before ) + '(\\d+)' + cloneIndex.escapeRegex( after ) + end ),
				newValue = before + index + after;

			return regex.test( value ) ? value.replace( regex, newValue ) : (alternative ? value + newValue : value );
		},

		/**
		 * Helper function to escape string in regular expression
		 * @link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
		 * @param string
		 * @return string
		 */
		escapeRegex: function ( string ) {
			return string.replace( /[.*+?^${}()|[\]\\]/g, "\\$&" );
		},

		/**
		 * Helper function to create next index for clones
		 * @param $container .swpmb-input container
		 * @return integer
		 */
		nextIndex: function ( $container ) {
			var nextIndex = $container.data( 'next-index' );

			// If we render cloneable fields via AJAX, the mb_ready event is not fired.
			// so nextIndex is undefined. In this case, we get the next index from the number of existing clones.
			if ( nextIndex === undefined ) {
				nextIndex = $container.children( '.swpmb-clone' ).length;
			}

			$container.data( 'next-index', nextIndex + 1 );
			return nextIndex;
		}
	};

	// Object holds all method related to fields' value when clone.
	var cloneValue = {
		setDefault: function() {
			var $field = $( this );

			if ( true !== $field.data( 'clone-default' ) ) {
				return;
			}

			var type = $field.attr( 'type' ),
				defaultValue = $field.data( 'default' );

			if ( 'radio' === type ) {
				$field.prop( 'checked', $field.val() === defaultValue );
			} else if ( $field.hasClass( 'swpmb-checkbox' ) || $field.hasClass( 'swpmb-switch' ) ) {
				$field.prop( 'checked', !! defaultValue );
			} else if ( $field.hasClass( 'swpmb-checkbox_list' ) ) {
				var value = $field.val();
				$field.prop( 'checked', Array.isArray( defaultValue ) ? -1 !== defaultValue.indexOf( value ) : value == defaultValue );
			} else if ( $field.is( 'select' ) ) {
				$field.find( 'option[value="' + defaultValue + '"]' ).prop( 'selected', true );
			} else if ( ! $field.hasClass( 'swpmb-hidden' ) ) {
				$field.val( defaultValue );
			}
		},
		clear: function() {
			const $field = $( this ),
				type = $field.attr( 'type' );

			if ( 'radio' === type || 'checkbox' === type ) {
				$field.prop( 'checked', false );
			} else if ( $field.is( 'select' ) ) {
				$field.prop( 'selectedIndex', 0 );
			} else if ( ! $field.hasClass( 'swpmb-hidden' ) ) {
				$field.val( '' );
			}
		}
	};

	/**
	 * Clone fields
	 * @param $container A div container which has all fields
	 */
	function clone( $container ) {
		var $last = $container.children( '.swpmb-clone' ).last(),
			$template = $container.children( '.swpmb-clone-template' ),
			$clone = $template.clone(),
			nextIndex = cloneIndex.nextIndex( $container );

		// Add _swpmb_template suffix to ID of fields in template.
		// so that the first clone will take the original ID.
		$template.find( swpmb.inputSelectors ).each( function () {
			this.id = this.id.includes( '_swpmb_template' ) ? this.id : this.id + '_swpmb_template';
		} );
		
		// Clear fields' values.
		var $inputs = $clone.find( swpmb.inputSelectors );		
		let count = $container.children( '.swpmb-clone' ).length;
		
		// The first clone should keep the default values.
		if ( count > 1 ) {
			$inputs.each( cloneValue.clear );
		}
		
		$clone = $clone.removeClass( 'swpmb-clone-template' );
		// Remove validation errors.
		$clone.find( 'p.swpmb-error' ).remove();
		
		// Insert clone.
		$clone.insertAfter( $last );
		count++;

		// Trigger custom event for the clone instance. Required for Group extension to update sub fields.
		$clone.trigger( 'clone_instance', nextIndex );

		// Set fields index. Must run before trigger clone event.
		cloneIndex.set( $inputs, nextIndex, count );

		// Set fields' default values: do after index is set to prevent previous radio fields from unchecking.
		$inputs.each( cloneValue.setDefault );

		// Trigger custom clone event.
		$inputs.trigger( 'clone', nextIndex );

		// After cloning fields.
		$inputs.trigger( 'after_clone', nextIndex );

		// Trigger custom change event for MB Blocks to update block attributes.
		$inputs.first().trigger( 'mb_change' );
	}

	/**
	 * Hide remove buttons when there's only 1 of them
	 *
	 * @param $container .swpmb-input container
	 */
	function toggleRemoveButtons( $container ) {

		const $clones = $container.children( '.swpmb-clone' );
		let minClone = 1;
		let offset = 1;

		// Add the first clone if data-clone-empty-start = false
		const cloneEmptyStart = $container[0].dataset.cloneEmptyStart ?? 0;

		// If clone-empty-start is true, we need at least 1 item.
		if ( cloneEmptyStart == 1 ) {
			offset = 0;
		}

		if ( $container.data( 'min-clone' ) ) {
			minClone = parseInt( $container.data( 'min-clone' ) );
		}
		$clones.children( '.remove-clone' ).toggle( $clones.length - offset > minClone );

		// Recursive for nested groups.
		$container.find( '.swpmb-input' ).each( function () {
			toggleRemoveButtons( $( this ) );
		} );
	}

	/**
	 * Toggle add button
	 * Used with [data-max-clone] attribute. When max clone is reached, the add button is hid and vice versa
	 *
	 * @param $container .swpmb-input container
	 */
	function toggleAddButton( $container ) {
		var $button = $container.children( '.add-clone' ),
			maxClone = parseInt( $container.data( 'max-clone' ) ) + 1,
			numClone = $container.children( '.swpmb-clone' ).length;

		$button.toggle( isNaN( maxClone ) || ( maxClone && numClone < maxClone ) );
	}

	function addClone( e ) {
		e.preventDefault();

		var $container = $( this ).closest( '.swpmb-input' );
		clone( $container );

		toggleRemoveButtons( $container );
		toggleAddButton( $container );
		sortClones.apply( $container[0] );
	}

	function removeClone( e ) {
		e.preventDefault();

		var $this = $( this ),
			$container = $this.closest( '.swpmb-input' );

		// Remove clone only if there are 2 or more of them
		if ( $container.children( '.swpmb-clone' ).length < 2 ) {
			return;
		}

		$this.parent().trigger( 'remove' ).remove();
		toggleRemoveButtons( $container );
		toggleAddButton( $container );

		// Trigger custom change event for MB Blocks to update block attributes.
		$container.find( swpmb.inputSelectors ).first().trigger( 'mb_change' );
	}

	/**
	 * Sort clones.
	 * Expect this = .swpmb-input element.
	 */
	function sortClones() {
		var $container = $( this );

		if ( undefined !== $container.sortable( 'instance' ) ) {
			return;
		}
		if ( 0 === $container.children( '.swpmb-clone' ).length ) {
			return;
		}

		$container.sortable( {
			handle: '.swpmb-clone-icon',
			placeholder: ' swpmb-clone swpmb-sortable-placeholder',
			items: '> .swpmb-clone',
			start: function ( event, ui ) {
				// Make the placeholder has the same height as dragged item
				ui.placeholder.height( ui.item.outerHeight() );
			},
			stop: function( event, ui ) {
				ui.item.trigger( 'mb_init_editors' );
				ui.item.find( swpmb.inputSelectors ).first().trigger( 'mb_change' );
			}
		} );
	}

	function start() {
		var $container = $( this );
		toggleRemoveButtons( $container );
		toggleAddButton( $container );

		$container.data( 'next-index', $container.children( '.swpmb-clone' ).length );
		sortClones.apply( this );
	}

	function init( e ) {
		$( e.target ).find( '.swpmb-input' ).each( start );
	}

	swpmb.$document
		.on( 'mb_ready', init )
		.on( 'click', '.add-clone', addClone )
		.on( 'click', '.remove-clone', removeClone );

	// Export for use outside.
	swpmb.cloneIndex = cloneIndex;
	swpmb.cloneValue = cloneValue;
	swpmb.sortClones = sortClones;
	swpmb.toggleRemoveButtons = toggleRemoveButtons;
	swpmb.toggleAddButton = toggleAddButton;
} )( jQuery, swpmb );
