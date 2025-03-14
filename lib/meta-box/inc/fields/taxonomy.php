<?php
defined( 'ABSPATH' ) || die;

/**
 * The taxonomy field which aims to replace the built-in WordPress taxonomy UI with more options.
 */
class SWPMB_Taxonomy_Field extends SWPMB_Object_Choice_Field {
	public static function add_actions() {
		add_action( 'wp_ajax_swpmb_get_terms', [ __CLASS__, 'ajax_get_terms' ] );
		add_action( 'wp_ajax_nopriv_swpmb_get_terms', [ __CLASS__, 'ajax_get_terms' ] );
	}

	public static function ajax_get_terms() {
		check_ajax_referer( 'query' );

		$request = swpmb_request();

		$field = $request->filter_post( 'field', FILTER_DEFAULT, FILTER_FORCE_ARRAY );

		// Required for 'choice_label' filter. See self::filter().
		$field['clone']        = false;
		$field['_original_id'] = $field['id'];

		// Search.
		$field['query_args']['name__like'] = $request->filter_post( 'term' );

		// Pagination.
		$limit = $field['query_args']['number'] ?? 0;
		$limit = (int) $limit;
		if ( 'query:append' === $request->filter_post( '_type' ) ) {
			$page                          = $request->filter_post( 'page', FILTER_SANITIZE_NUMBER_INT );
			$field['query_args']['offset'] = $limit * ( $page - 1 );
		}

		// Query the database.
		$items = self::query( null, $field );
		$items = array_values( $items );

		$items = apply_filters( 'swpmb_ajax_get_terms', $items, $field, $request );

		$data = [ 'items' => $items ];

		// More items for pagination.
		if ( $limit && count( $items ) === $limit ) {
			$data['more'] = true;
		}

		wp_send_json_success( $data );
	}

	/**
	 * Add default value for 'taxonomy' field.
	 *
	 * @param array $field Field parameters.
	 * @return array
	 */
	public static function normalize( $field ) {
		// Backwards compatibility with field args.
		if ( isset( $field['options']['args'] ) ) {
			$field['query_args'] = $field['options']['args'];
		}
		if ( isset( $field['options']['taxonomy'] ) ) {
			$field['taxonomy'] = $field['options']['taxonomy'];
		}
		if ( isset( $field['options']['type'] ) ) {
			$field['field_type'] = $field['options']['type'];
		}

		// Set default field args.
		$field = wp_parse_args( $field, [
			'taxonomy'       => 'category',
			'query_args'     => [],
			'remove_default' => false,
		] );

		// Force taxonomy to be an array.
		$field['taxonomy'] = (array) $field['taxonomy'];

		/*
		 * Set default placeholder:
		 * - If multiple taxonomies: show 'Select a term'.
		 * - If single taxonomy: show 'Select a %taxonomy_name%'.
		 */
		$placeholder   = __( 'Select a term', 'meta-box' );
		$taxonomy_name = self::get_taxonomy_singular_name( $field );
		if ( $taxonomy_name ) {
			// Translators: %s is the taxonomy singular label.
			$placeholder = sprintf( __( 'Select a %s', 'meta-box' ), strtolower( $taxonomy_name ) );
		}
		$field = wp_parse_args( $field, [
			'placeholder' => $placeholder,
		] );

		$field = parent::normalize( $field );

		// Set default query args.
		$limit               = $field['ajax'] ? 10 : 0;
		$field['query_args'] = wp_parse_args( $field['query_args'], [
			'taxonomy' => $field['taxonomy'],
			'number'   => $limit,
		] );

		parent::set_ajax_params( $field );

		// Prevent cloning for taxonomy field, not for child fields (taxonomy_advanced).
		if ( 'taxonomy' === $field['type'] ) {
			$field['clone'] = false;
		}

		return $field;
	}

	public static function query( $meta, array $field ): array {
		$args = wp_parse_args( $field['query_args'], [
			'hide_empty'             => false,
			'count'                  => false,
			'update_term_meta_cache' => false,
		] );

		$meta = wp_parse_id_list( (array) $meta );

		// Query only selected items.
		if ( ! empty( $field['ajax'] ) && ! empty( $meta ) ) {
			$args['include'] = $meta;
			$args['number']  = count( $meta );
		}

		$terms = get_terms( $args );
		if ( ! is_array( $terms ) ) {
			return [];
		}
		$options = [];
		foreach ( $terms as $term ) {
			$label = $term->name ? $term->name : __( '(No title)', 'meta-box' );
			$label = self::filter( 'choice_label', $label, $field, $term );

			$options[ $term->term_id ] = [
				'value'  => $term->term_id,
				'label'  => $label,
				'parent' => $term->parent,
			];
		}
		return $options;
	}

	/**
	 * Get meta values to save.
	 *
	 * @param mixed $new     The submitted meta value.
	 * @param mixed $old     The existing meta value.
	 * @param int   $post_id The post ID.
	 * @param array $field   The field parameters.
	 *
	 * @return array
	 */
	public static function value( $new, $old, $post_id, $field ) {
		$new   = (array) $new;
		$new[] = self::add_term( $field );
		$new   = array_filter( wp_parse_id_list( $new ) );

		return $new;
	}

	/**
	 * Save meta value.
	 *
	 * @param mixed $new     The submitted meta value.
	 * @param mixed $old     The existing meta value.
	 * @param int   $post_id The post ID.
	 * @param array $field   The field parameters.
	 */
	public static function save( $new, $old, $post_id, $field ) {
		if ( empty( $field['id'] ) || ! $field['save_field'] ) {
			return;
		}

		foreach ( $field['taxonomy'] as $taxonomy ) {
			wp_set_object_terms( $post_id, $new, $taxonomy );
		}
	}

	/**
	 * Add new terms if users created some.
	 *
	 * @param array $field Field settings.
	 * @return int|null Term ID if added successfully, null otherwise.
	 */
	protected static function add_term( $field ) {
		$term = swpmb_request()->post( $field['id'] . '_new' );
		if ( ! $field['add_new'] || ! $term || 1 !== count( $field['taxonomy'] ) ) {
			return null;
		}

		$taxonomy = reset( $field['taxonomy'] );
		$term     = wp_insert_term( $term, $taxonomy );
		if ( is_wp_error( $term ) ) {
			return null;
		}
		return $term['term_id'] ?? null;
	}

	/**
	 * Get raw meta value.
	 *
	 * @param int   $object_id Object ID.
	 * @param array $field     Field parameters.
	 * @param array $args      Arguments of {@see swpmb_meta()} helper.
	 *
	 * @return mixed
	 */
	public static function raw_meta( $object_id, $field, $args = [] ) {
		if ( empty( $field['id'] ) ) {
			return '';
		}

		$meta = wp_get_object_terms( $object_id, $field['taxonomy'], [
			'orderby' => 'term_order',
		] );
		$meta = wp_list_pluck( $meta, 'term_id' );

		return $field['multiple'] ? $meta : reset( $meta );
	}

	/**
	 * Get the field value.
	 * Return list of post term objects.
	 *
	 * @param  array $field   Field parameters.
	 * @param  array $args    Additional arguments.
	 * @param  ?int  $post_id Post ID.
	 *
	 * @return array List of post term objects.
	 */
	public static function get_value( $field, $args = [], $post_id = null ) {
		if ( ! $post_id ) {
			$post_id = get_the_ID();
		}
		$value = wp_get_object_terms( $post_id, $field['taxonomy'], [
			'orderby' => 'term_order',
		] );

		// Get single value if necessary.
		if ( ! $field['clone'] && ! $field['multiple'] ) {
			$value = reset( $value );
		}
		return $value;
	}

	/**
	 * Format a single value for the helper functions.
	 *
	 * @param array   $field   Field parameters.
	 * @param WP_Term $value   The term object.
	 * @param array   $args    Additional arguments. Rarely used. See specific fields for details.
	 * @param ?int    $post_id Post ID. null for current post. Optional.
	 *
	 * @return string
	 */
	public static function format_single_value( $field, $value, $args, $post_id ) {
		if ( empty( $value ) ) {
			return '';
		}

		$link = $args['link'] ?? 'view';
		$text = $value->name;

		if ( false === $link ) {
			return $text;
		}
		$url = get_term_link( $value );
		if ( 'edit' === $link ) {
			$url = get_edit_term_link( $value );
		}

		return sprintf( '<a href="%s">%s</a>', esc_url( $url ), esc_html( $text ) );
	}

	public static function add_new_form( array $field ): string {
		if ( ! current_user_can( 'edit_posts' ) ) {
			return '';
		}

		// Only add new term if field has only one taxonomy.
		if ( 1 !== count( $field['taxonomy'] ) ) {
			return '';
		}

		$taxonomy        = reset( $field['taxonomy'] );
		$taxonomy_object = get_taxonomy( $taxonomy );
		if ( false === $taxonomy_object ) {
			return '';
		}

		return sprintf(
			'<a href="#" class="swpmb-taxonomy-add-button swpmb-modal-add-button" data-url="%s">%s</a>',
			admin_url( 'edit-tags.php?taxonomy=' . $taxonomy_object->name ),
			esc_html( $taxonomy_object->labels->add_new_item )
		);
	}

	public static function admin_enqueue_scripts() {
		$field = func_get_arg( 0 );
		parent::admin_enqueue_scripts( $field );
		static::remove_default_meta_box( $field );
	}

	protected static function remove_default_meta_box( array $field ) {
		if ( empty( $field['remove_default'] ) || ! function_exists( 'remove_meta_box' ) ) {
			return;
		}

		// Only run in admin.
		if ( ! is_admin() ) {
			return;
		}

		// Do nothing if in Ajax or Rest API.
		if ( defined( 'DOING_AJAX' ) && DOING_AJAX ) {
			return;
		}
		if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) {
			return;
		}

		foreach ( $field['taxonomy'] as $taxonomy ) {
			$id = is_taxonomy_hierarchical( $taxonomy ) ? "{$taxonomy}div" : "tagsdiv-{$taxonomy}";
			remove_meta_box( $id, null, 'side' );
		}
	}

	protected static function get_taxonomy_singular_name( array $field ): string {
		if ( 1 !== count( $field['taxonomy'] ) ) {
			return '';
		}
		$taxonomy        = reset( $field['taxonomy'] );
		$taxonomy_object = get_taxonomy( $taxonomy );

		return false === $taxonomy_object ? '' : $taxonomy_object->labels->singular_name;
	}
}
