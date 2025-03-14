<?php
/**
 * The clone module, allowing users to clone (duplicate) fields.
 */
class SWPMB_Clone {
	public static function html( array $meta, array $field ) : string {
		$field_html = '';

		$count = count( $meta );
		foreach ( $meta as $index => $sub_meta ) {
			$sub_field               = $field;
			$sub_field['field_name'] = $field['field_name'] . "[{$index}]";
			$attributes_id = $sub_field['attributes']['id'] ?? $sub_field['id'];

			if ( $index === 0 && $count > 1 ) {
				$sub_field['attributes']['id'] = $attributes_id . "_swpmb_template";
			}

			if ( $index === 1 ) {
				$sub_field['attributes']['id'] = $attributes_id;
			}

			if ( $index > 1 ) {
				if ( isset( $sub_field['address_field'] ) ) {
					$sub_field['address_field'] = $field['address_field'] . "_{$index}";
				}
				$sub_field['id'] = $field['id'] . "_{$index}";

				if ( ! empty( $sub_field['attributes']['id'] ) ) {
					$sub_field['attributes']['id'] .= "_{$index}";
				}
			}

			if ( in_array( $sub_field['type'], [ 'file', 'image' ], true ) ) {
				$sub_field['input_name']  = '_file_' . uniqid();
				$sub_field['index_name'] .= "[{$index}]";
			} elseif ( $field['multiple'] ) {
				$sub_field['field_name'] .= '[]';
			}

			// Wrap field HTML in a div with class="swpmb-clone" if needed.
			$class     = "swpmb-clone swpmb-{$field['type']}-clone";
			$sort_icon = '';
			if ( $field['sort_clone'] ) {
				$class    .= ' swpmb-sort-clone';
				$sort_icon = "<a href='javascript:;' class='swpmb-clone-icon'></a>";
			}

			$class .= $index === 0 ? ' swpmb-clone-template' : '';
			$input_html = "<div class='$class'>" . $sort_icon;

			// Call separated methods for displaying each type of field.
			$input_html .= SWPMB_Field::call( $sub_field, 'html', $sub_meta );
			$input_html  = SWPMB_Field::filter( 'html', $input_html, $sub_field, $sub_meta );

			// Remove clone button.
			$input_html .= self::remove_clone_button( $sub_field );
			$input_html .= '</div>';

			$field_html .= $input_html;
		}

		return $field_html;
	}

	/**
	 * Set value of meta before saving into database
	 *
	 * @param mixed $new       The submitted meta value.
	 * @param mixed $old       The existing meta value.
	 * @param int   $object_id The object ID.
	 * @param array $field     The field parameters.
	 *
	 * @return mixed
	 */
	public static function value( $new, $old, $object_id, array $field ) {
		if ( ! is_array( $new ) ) {
			$new = [];
		}

		if ( in_array( $field['type'], [ 'file', 'image' ], true ) ) {
			$new = SWPMB_File_Field::clone_value( $new, $old, $object_id, $field );
		} else {
			foreach ( $new as $key => $value ) {
				$old_value   = $old[ $key ] ?? null;
				$value       = SWPMB_Field::call( $field, 'value', $value, $old_value, $object_id );
				$new[ $key ] = SWPMB_Field::filter( 'sanitize', $value, $field, $old_value, $object_id );
			}
		}

		// Remove empty clones.
		$new = array_filter( $new, 'SWPMB_Helpers_Value::is_valid_for_field' );

		// Reset indexes.
		$new = array_values( $new );

		return $new;
	}

	public static function add_clone_button( array $field ) : string {
		if ( ! $field['clone'] ) {
			return '';
		}
		$text = SWPMB_Field::filter( 'add_clone_button_text', $field['add_button'], $field );
		return '<a href="#" class="swpmb-button button add-clone">' . esc_html( $text ) . '</a>';
	}

	public static function remove_clone_button( array $field ) : string {
		$text = SWPMB_Field::filter( 'remove_clone_button_text', '<span class="dashicons dashicons-dismiss"></span>', $field );
		return '<a href="#" class="swpmb-button remove-clone">' . $text . '</a>';
	}
}
