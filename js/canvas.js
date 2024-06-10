import { loadSvg, loadFile, randomInt, resolver } from './utils.js'

const log = console.log.bind( console )

// Safari fix
const Matrix = window.DOMMatrix || window.WebKitCSSMatrix

/** @type {Partial<Pick<CanvasRenderingContext2D, "fillStyle" | "font" | "textAlign" | "textBaseline">>} */
const textDefaultStyles = {
	font: '30px sans-serif',
	textBaseline: 'top',
}

/**
 * All canvas attributes that can be accepted by the component options parameter.
 *
 * @type {(keyof Pick<CanvasRenderingContext2D, "fillStyle" | "lineCap" | "lineWidth" | "strokeStyle" | "shadowColor" | "shadowBlur" | "shadowOffsetX" | "shadowOffsetY" | "font" | "textAlign" | "textBaseline">)[]} */
const canvasStyleKeys = [ 'fillStyle', 'lineCap', 'lineWidth', 'strokeStyle', 'shadowColor', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY', 'font', 'textAlign', 'textBaseline' ]

/**
 * Valid vector shapes.
 *
 * @type {{ rectangle: 'rectangle', circle: 'circle' }}
 */
const SHAPES = { rectangle: 'rectangle', circle: 'circle' }

/**
 * Defined components.
 *
 * @type {{ Sprite: 'Sprite', Text: 'Text', Vector: 'Vector' }}
 */
const COMPONENTS = { Sprite: 'Sprite', Text: 'Text', Vector: 'Vector' }

/**
 * Canvas controller factory.
 *
 * @param {Element} container
 * @param {number} width
 * @param {number} height
 */
export default function Canvas( container, width, height ) {
	/** @type {HTMLCanvasElement} */
	let canvas

	/** @type {CanvasRenderingContext2D} */
	let ctx

	/**
	 * Components are various objects that define and control canvas shapes.
	 *
	 * @type {(ReturnType<typeof Sprite> | ReturnType<typeof Text> | ReturnType<typeof Vector>)[]}
	 *
	 */
	const components = []

	/**
	 * Registered events, per event type and component.
	 *
	 * @type {Record<string, Map<ReturnType<typeof Vector>, [ onEvent: (target: ReturnType<typeof Vector>, e: MouseEvent, x: number, y: number ) => void, onUncapturedEvent?: (target: ReturnType<typeof Vector>, e: MouseEvent, x: number, y: number ) => void ] >>} */
	const eventRegistry = {}

	/** @type {[number,number]} */
	const mousePosition = [ 0, 0 ]

	/** @type {{[animationName: string]: { complete: boolean, reset: boolean, completeAsync: ReturnType<typeof resolver>[0], setCompleteAsync: ReturnType<typeof resolver>[1], animationFn: ({elapsed, remainingTime, frameCoefficient}: {elapsed: number, remainingTime: number, frameCoefficient: number}) => void}}} */
	const animations = {}

	/** @type {{[intervalName: string]: () => void}} */
	const intervals = {}

	// `sprites` is a promise containing external assets while they are loading
	// setSprite is used to resolve the promise
	let spriteNum = 0
	const [ sprites, setSprite ] = resolver( [],
		( newSprite, spriteData ) => {
			spriteData.push( newSprite )
			spriteNum = spriteData.length
			return spriteData
		},
	)

	async function init() {
		canvas = container.querySelector( 'canvas' )
		ctx = canvas.getContext( '2d' )
		canvas.width = width
		canvas.height = height
		container.appendChild( canvas )
	}

	const api = {
		get mousePosition() {
			return Object.freeze( [ ...mousePosition ] )
		},

		get width() {
			return width
		},
		get height() {
			return height
		},

		/**
		 * Get component by name and type.
		 *
		 * @template {keyof typeof COMPONENTS} Type
		 * @param {Type} type
		 * @param {string} name
		 * @return {ReturnType<{ Sprite: typeof Sprite, Text: typeof Text, Vector: typeof Vector }[Type]>}
		 */
		getComponent( type, name ) {
			const cmp = components.find( ( c ) => c.type === type && c.name === name )

			if ( ! cmp ) {
				const found = components.find( ( c ) => c.name === name )
				throw new Error( `Cannot find a component with name '${ name }' of type '${ type }'. ${ found ? `Did you mean '${ found.type }'?` : '' }` )
			}

			// @ts-ignore
			return cmp
		},

		/**
		 * @param {string} name
		 * @return {ReturnType<typeof Vector>}
		 */
		getVector( name ) {
			return this.getComponent( 'Vector', name )
		},

		/**
		 * @param {string} name
		 *  return {ReturnType<typeof Vector>}
		 */
		getSprite( name ) {
			return this.getComponent( 'Sprite', name )
		},

		/**
		 * @param {string} name
		 *  return {ReturnType<typeof Vector>}
		 */
		getText( name ) {
			return this.getComponent( 'Text', name )
		},

		/**
		 * Add image or SVG graphics.
		 *
		 * @param {string} name
		 * @param {string} source
		 * @param {Parameters<typeof Sprite>[3]} options
		 */
		addSprite( name, source, options = {} ) {
			const { autoDomainMargin, svg, scaleFactor, scaleTo, fitToCanvas } = options

			const component = Sprite( name, canvas, ctx, options )
			component.loadSprite( source, { autoDomainMargin, svg, scaleFactor, scaleTo, fitToCanvas } )

			setSprite( Promise.resolve( component.ready() ).then( ( data ) => {
				return data
			} ) )
		},

		/**
		 * Add text to canvas.
		 *
		 * @param {string} name
		 * @param {Parameters<typeof Text>[3]} options
		 */
		addText( name, options ) {
			const component = Text( name, canvas, ctx, options )
			components.push( component )
			return component
		},

		/**
		 * Add simple SVG file as a vector path (shape).
		 *
		 * @param {string} name
		 * @param {string} source
		 * @param {Parameters<typeof Vector>[3]} options
		 */
		addVectorPath( name, source, options = {} ) {
			const component = Vector( name, canvas, ctx, options )

			const { scaleFactor, scaleTo } = options
			component.loadSvg( source, { scaleFactor, scaleTo } )

			setSprite( Promise.resolve( component.ready() ).then( ( data ) => {
				return data
			} ) )

			return component
		},

		/**
		 * Add vector shape (circle or rectangle)
		 *
		 * @param {string} name
		 * @param {Parameters<typeof Vector>[3]} options
		 */
		addVectorShape( name, options = {} ) {
			const component = Vector( name, canvas, ctx, options )
			components.push( component )
			return component
		},

		/**
		 * Remove component from component list.
		 *
		 * @param {string} name
		 * @param {keyof typeof COMPONENTS} type
		 */
		deleteComponent( name, type ) {
			const index = components.findIndex( ( c ) => c.name === name )

			if ( index < 0 ) {
				console.error( `Delete error: component not found (${ name }).` )
				return
			}

			components.splice( index, 1 )
			return true
		},

		/**
		 * Trigger an animation.
		 *
		 * @param {string} animationName
		 * @param {number} duration
		 * @param {({elapsed, remainingTime, frameCoefficient}: {elapsed: number, remainingTime: number, frameCoefficient: number}) => void} animationFn
		 * @param {() => void} onCompleteCallback
		 */
		animate( animationName, duration, animationFn, onCompleteCallback = undefined ) {
			let start, previousTimeStamp

			/**
			 * Used to calculate frameCoefficient
			 */
			const relativeDuration = 1 / duration

			if ( animationName in animations ) {
				animations[ animationName ].reset = true
			}
			else {
				const [ completeAsync, setCompleteAsync ] = resolver()

				animations[ animationName ] = {
					completeAsync,
					setCompleteAsync,
					complete: false,
					reset: false,
					animationFn,
				}
			}

			/**
			 * Render animation frame.
			 *
			 * @param {number} timeStamp
			 */
			const animationFrame = ( timeStamp ) => {
				start ??= timeStamp
				const elapsed = timeStamp - start
				const animation = animations[ animationName ]

				// Animation has been aborted
				if ( ! animation ) {
					return
				}

				/**
				 * Fraction of animation that has elapsed (`1/duration * elapsed`).
				 *
				 * @type {number}
				 */
				let frameCoefficient

				// Animation should restart?
				if ( animation.reset ) {
					animations[ animationName ].reset = false
					requestAnimationFrame( animationFrame )
					return
				}
				// Render next animation frame
				else if ( previousTimeStamp !== timeStamp ) {
					frameCoefficient = relativeDuration * elapsed

					if ( elapsed ) {
						animationFn( { elapsed, remainingTime: duration - elapsed, frameCoefficient: frameCoefficient || 0 } )

						this.clear()
						this.render()
					}
				}

				if ( animation.complete || elapsed >= duration ) {
					if ( typeof onCompleteCallback === 'function' ) {
						onCompleteCallback()
					}

					animations[ animationName ].setCompleteAsync()
					delete animations[ animationName ]
				}
				// If time elapsed < duration, continue
				else if ( elapsed < duration ) {
					previousTimeStamp = timeStamp

					if ( ! animation.complete ) {
						requestAnimationFrame( animationFrame )
					}
				}
			}

			requestAnimationFrame( animationFrame )

			return animations[ animationName ].completeAsync
		},

		/**
		 * Execute a function on an interval.
		 *
		 * The interval is registered so that it will not be executed if already running.
		 *
		 * Returns cancel function.
		 *
		 * @param {string} intervalName
		 * @param {number} interval
		 * @param {(cancel: () => void, count: number) => void} intervalFn
		 */
		addInterval( intervalName, interval, intervalFn ) {
			if ( intervals[ intervalName ] ) {
				return intervals[ intervalName ]
			}

			// eslint-disable-next-line prefer-const
			let timer
			let count = 0

			const cancel = () => {
				clearTimeout( timer )
			}

			timer = setInterval( () => {
				count++
				intervalFn( cancel, count )
			}, interval )

			// Save interval cancel function to registry
			intervals[ intervalName ] = cancel

			return cancel
		},

		/**
		 * Add `click` or `mousemove` event listeners (others not supported). Can only be used with Vector component.
		 *
		 * Each target (component) may register one callback per event.
		 *
		 * Each target may also register a callback that is executed if the event is fired but not captured by any other components.
		 *
		 * Uncaptured event callbacks can be used to detect when the mouse moves off a target inside the canvas (where mouseleave does not work).
		 *
		 * @param {string} type
		 * @param {string|ReturnType<typeof Vector>} target
		 * @param {(target: ReturnType<typeof Vector>, e: MouseEvent, x: number, y: number ) => void} onEvent
		 * @param {(target: ReturnType<typeof Vector>, e: MouseEvent, x: number, y: number ) => void} onUncapturedEvent
		 */
		addEvent( type, target, onEvent, onUncapturedEvent = undefined ) {
			if ( ! eventRegistry[ type ] ) {
				eventRegistry[ type ] = new Map()
			}

			const component = typeof target === 'string' ? this.getVector( target ) : target

			if ( ! component ) {
				console.error( `Cannot register ${ type } event: component not found.` )
				log( { target } )
				return
			}

			if ( component.type !== 'Vector' ) {
				const err = `Cannot register ${ type } event: events can only be added to 'Vector' components (received: '${ component.type }')`
				console.error( err )
				log( { target } )
				return
			}

			eventRegistry[ type ].set( component, [ onEvent, onUncapturedEvent ] )
		},

		/**
		 * Add `click` event listeners. Can only be used with Vector component.
		 *
		 * @param {string|ReturnType<typeof Vector>} target
		 * @param {(target: ReturnType<typeof Vector>, e: MouseEvent, x: number, y: number ) => void} onEvent
		 * @param {(target: ReturnType<typeof Vector>, e: MouseEvent, x: number, y: number ) => void} onUncapturedEvent
		 */
		addClickEvent( target, onEvent, onUncapturedEvent = undefined ) {
			return this.addEvent( 'click', target, onEvent, onUncapturedEvent )
		},

		/**
		 * @param {string} type
		 * @param {string|ReturnType<typeof Vector>} target
		 */
		removeEvent( type, target ) {
			if ( ! eventRegistry[ type ] ) {
				return this
			}

			const component = typeof target === 'string' ? this.getVector( target ) : target
			if ( component && component.type === 'Vector' ) {
				eventRegistry[ type ].delete( component )
			}
		},

		/**
		 * @param {string|ReturnType<typeof Vector>} target
		 */
		removeClickEvent( target ) {
			return this.removeEvent( 'click', target )
		},

		/**
		 * Listens for events and executes registered event callbacks.
		 */
		startEventListeners() {
			/**
			 * @param {MouseEvent} e
			 */
			const clickHandler = ( e ) => {
				if ( ! eventRegistry.click ) {
					return
				}

				const x = e.clientX - canvas.offsetLeft
				const y = e.clientY - canvas.offsetTop

				for ( const [ target, eventFns ] of eventRegistry.click ) {
					const [ eventFn ] = eventFns

					if ( target.isPointInPath( x, y ) ) {
						eventFn( target, e, x, y )
						return
					}
				}

				// Uncaptured events
				// If the event was not captured by a component, other events may execute their uncaptured event callbacks
				for ( const [ target, eventFns ] of eventRegistry.click ) {
					const [ __, otherEventFn ] = eventFns
					if ( otherEventFn ) {
						otherEventFn( target, e, x, y )
					}
				}
			}

			/**
			 * @param {MouseEvent} e
			 */
			const mousemoveHandler = ( e ) => {
				if ( ! eventRegistry.mousemove ) {
					return
				}

				const x = e.clientX - canvas.offsetLeft
				const y = e.clientY - canvas.offsetTop

				mousePosition[ 0 ] = x
				mousePosition[ 1 ] = y

				for ( const [ target, eventFns ] of eventRegistry.mousemove ) {
					const [ eventFn ] = eventFns
					// log( 'mousemove', target.isPointInPath( x, y ) )
					if ( target.isPointInPath( x, y ) ) {
						eventFn( target, e, x, y )
						return
					}
				}

				// Uncaptured events
				// If the event was not captured by a component, other events may execute their uncaptured event callbacks
				for ( const [ target, eventFns ] of eventRegistry.mousemove ) {
					const [ __, otherEventFn ] = eventFns
					if ( otherEventFn ) {
						otherEventFn( target, e, x, y )
					}
				}
			}

			canvas.addEventListener( 'click', clickHandler )
			canvas.addEventListener( 'mousemove', mousemoveHandler )
		},

		/**
		 * Check if external assets have finished loading.
		 */
		async spritesLoaded() {
			if ( ! spriteNum ) {
				return []
			}

			const spriteArr = await sprites
			const resolvedSprites = await Promise.all( spriteArr )

			components.push( ...resolvedSprites )
			return resolvedSprites
		},

		/**
		 * Sort components by z-index (last painted is on top)
		 */
		sortComponents() {
			components.sort( ( a, b ) => {
				return a.zIndex - b.zIndex
			} )
		},

		/**
		 * Erase canvas.
		 */
		clear() {
			ctx.clearRect( 0, 0, canvas.width, canvas.height )
		},

		/**
		 * Paint all components.
		 */
		async render() {
			this.sortComponents()
			components.forEach( ( component ) => component.render() )
		},
	}

	init()

	return api
}

/**
 * Base component factory.
 *
 * Shared functions and props used by components. The base component is inherited/extended by child components.
 *
 * @template {keyof typeof COMPONENTS} ComponentType
 * @template Config
 * @param {string} name
 * @param {ComponentType} componentType
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D} ctx
 * @param {Config & Partial<{visible: boolean, x: number, y: number, width: number, height: number, zIndex: number, domain: [number,number,number,number], scaleFactor?: number, outline: boolean, noFill: boolean} & Partial<Pick<CanvasRenderingContext2D, typeof canvasStyleKeys[number]>>>} config
 * @return {[typeof props,typeof ApiFactory]}
 */
function BaseComponent( componentType, name, canvas, ctx, config ) {
	/** @type {Partial<{[Key in typeof canvasStyleKeys[number]]: typeof ctx[Key]}>}  */
	// @ts-ignore
	const canvasStyle = canvasStyleKeys.reduce( ( result, key ) => {
		if ( key in config ) {
			result[ key ] = config[ key ]
			delete config[ key ]
		}

		return result
	}, {} )

	/**
	 * @type {typeof config & {name: string, type: ComponentType, canvasStyle: typeof canvasStyle, prevStyle: canvasStyle}}
	 */
	const props = Object.assign( {
		name,
		type: componentType,
		x: 0,
		y: 0,
		width: undefined,
		height: undefined,
		visible: false,
		domain: undefined,
		noFill: false,
		outline: false,
		canvasStyle,
		prevStyle: null,
		zIndex: 0,
	}, config )

	/**
	 * Merge parent and child methods.
	 *
	 * Sets context of polymorphic `this` to refer to the merged object.
	 *
	 * @template SubType Child method type
	 * @template [ExtendedType=SubType & typeof coreApi] Merged methods type
	 * @this {ExtendedType} Polymorphic `this`
	 * @param {SubType} subTypeApi Child methods
	 */
	function ApiFactory( subTypeApi ) {
		const coreApi = {
			canvasStyle,
			prevStyle: props.prevStyle,

			get name() {
				return props.name
			},

			/**
			 *  type {typeof canvasStyle}
			 */
			get styles() {
				/* * @type {{[Key in typeof canvasStyleKeys[number]]: typeof ctx[Key]}} */
				// @ts-ignore
				// const cs = canvasStyleKeys.reduce( ( result, key ) => {
				// 	result[ key ] = ctx[ key ]
				// 	return result
				// }, {} )

				return Object.freeze( { ...canvasStyle } )
			},
			get type() {
				return props.type
			},
			get height() {
				return props.height
			},
			get visible() {
				return props.visible
			},
			get width() {
				return props.width
			},
			get x() {
				return props.x
			},
			get y() {
				return props.y
			},
			get zIndex() {
				return props.zIndex
			},

			hide() {
				props.visible = false
				return this
			},

			show() {
				props.visible = true
				return this
			},

			/**
			 * Create a virtual frame that define the max/min coordinates for the component.
			 *
			 * @param {{autoDomainMargin: boolean, domain?: [number,number,number,number]}} props
			 */
			setDomain( { autoDomainMargin = false, domain = undefined } ) {
				if ( autoDomainMargin ) {
					props.domain = [
						props.width,
						props.height,
						canvas.width - props.width,
						canvas.height - props.height,
					]
				}
				else if ( Array.isArray( domain ) && domain.length === 4 ) {
					props.domain = domain
				}
				else {
					props.domain = [ 0, 0, canvas.width, canvas.height ]
				}
				return this
			},

			/**
			 * Set x/y coordinates.
			 *
			 * Null values will be replaced with a random value.
			 *
			 * @param {number|null} x
			 * @param {number|null} y
			 */
			setPosition( x = null, y = null ) {
				props.x = x === null ? randomInt( props.domain[ 0 ], props.domain[ 2 ] ) : x
				props.y = y === null ? randomInt( props.domain[ 1 ], props.domain[ 3 ] ) : y
				return this
			},

			/**
			 * Change size.
			 *
			 * If both values are undefined, they are set to canvas width/height.
			 *
			 * @param {number} width
			 * @param {number} height
			 */
			setSize( width = undefined, height = undefined ) {
				if ( width === undefined && height === undefined ) {
					props.width = canvas.width
					props.height = canvas.height
				}
				else {
					props.width = width === null ? props.width : width
					props.height = height === null ? props.height : height
				}

				return this
			},

			/**
			 * Set a number of style attributes.
			 *
			 * @param {Partial<Pick<CanvasRenderingContext2D, typeof canvasStyleKeys[number]>>} styles
			 */
			setStyle( styles ) {
				Object.entries( styles ).forEach( ( [ key, value ] ) => {
					props.canvasStyle[ key ] = value
				} )
				return this
			},

			/**
			 * Save current style set so it can be recalled later.
			 */
			saveStyle() {
				if ( props.prevStyle ) {
					return this
				}

				props.prevStyle = { ...props.canvasStyle }
				return this
			},

			/**
			 * Recall saved style set (saved styles will be erased after).
			 */
			revertStyle() {
				if ( ! props.prevStyle ) {
					return this
				}

				Object.entries( props.prevStyle ).forEach( ( [ key, value ] ) => {
					props.canvasStyle[ key ] = value
				} )

				props.prevStyle = null
				return this
			},

			/**
			 * Apply style attributes to canvas object with style attributes.
			 *
			 * Runs before each render.
			 *
			 * @return {void}
			 */
			applyStyles() {
				Object.entries( props.canvasStyle ).forEach( ( [ key, value ] ) => {
					ctx[ key ] = value
				} )
			},

			toString() {
				return JSON.stringify( props, null, 4 )
			},

			render() {
				throw new Error( 'Fatal error: BaseComponent cannot be initialized on its own.' )
			},

			...subTypeApi,
		}

		return coreApi
	}

	return [ props, ApiFactory ]
}

/**
 * Text component factory.
 *
 * @param {string} name
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D} ctx
 * @param {Parameters<typeof BaseComponent>[4] & {text: string}} config
 */
function Text( name, canvas, ctx, config ) {
	const [ superProps, superFactory ] = BaseComponent( COMPONENTS.Text, name, canvas, ctx, config )

	/**
	 * @type {typeof superProps}
	 */
	const props = Object.assign( superProps, {
		canvasStyle: { ...textDefaultStyles, ...superProps.canvasStyle },
	} )

	const api = superFactory( {
		/**
		 * @param {string} text
		 * @return Component
		 */
		setText( text ) {
			props.text = text
			return api
		},

		render() {
			if ( props.visible ) {
				ctx.save()
				api.applyStyles()

				if ( props.outline ) {
					ctx.lineJoin = 'round'
					ctx.miterLimit = 2
					ctx.strokeText( props.text, props.x, props.y )
				}

				if ( ! props.noFill ) {
					ctx.fillText( props.text, props.x, props.y )
				}

				ctx.restore()
			}
		},
	} )

	return api
}

/**
 * Vector component factory. Create vector elements, including SVG paths, rectangles and circles.
 *
 * Vectors can be used for mouse event detection.
 *
 * @param {string} name
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D} ctx
 * @param {Parameters<typeof BaseComponent>[4] & Parameters<typeof scaleObject>[2] & {shape?: keyof typeof SHAPES, radius?: number}} config
 * @return {typeof api}
 */
function Vector( name, canvas, ctx, config ) {
	const [ superProps, superFactory ] = BaseComponent( 'Vector', name, canvas, ctx, config )
	const [ svgFile, setSvgFileLoaded ] = resolver()

	/**
	 * @type {typeof superProps & {path2d: Path2D, path: string, scale: number, originalSize: { width: number, height: number}}}
	 */
	const props = Object.assign( superProps, {
		type: COMPONENTS.Vector,
		path2d: undefined,
		path: undefined,
		scale: undefined,
		originalSize: {
			width: undefined,
			height: undefined,
		},
	} )

	const api = superFactory( {
		/**
		 * Load SVG file.
		 *
		 * @param {string} svgUrl
		 * @param {Parameters<typeof scaleObject>[2]} options
		 */
		async loadSvg( svgUrl, { scaleFactor = 1, scaleTo = undefined } ) {
			const svg = await loadFile( svgUrl )

			const svgContainer = document.createElement( 'div' )
			svgContainer.innerHTML = svg

			const svgEl = svgContainer.firstElementChild
			const width = parseInt( svgEl.attributes.getNamedItem( 'width' ).value )
			const height = parseInt( svgEl.attributes.getNamedItem( 'height' ).value )

			// Because of how Path2d works, width/height must be calculated from original values when they are resized
			props.originalSize = { width, height }
			props.path = svgEl.querySelector( 'path' ).attributes.getNamedItem( 'd' ).value

			api.setScale( scaleFactor, scaleTo )
			setSvgFileLoaded()
		},

		/**
		 * @param {keyof typeof SHAPES} shape
		 * @return Component
		 */
		setShape( shape ) {
			props.path2d = new Path2D()
			props.shape = shape

			return api
		},

		/**
		 * Scale a shape relative to the canvas.
		 *
		 * Define which dimension to use: longest side, shorted side or both (combined)
		 *
		 * @param {number} scaleFactor
		 * @param {'longest'|'shortest'|'combined'} scaleTo
		 * @return Component
		 */
		setScale( scaleFactor, scaleTo = 'combined' ) {
			props.scale = scaleObject( { ...props.originalSize }, canvas, { scaleFactor, scaleTo } )

			return api
		},

		/**
		 * Set radius of circle.
		 *
		 * @param {number} radius
		 * @return Component
		 */
		setRadius( radius ) {
			props.radius = radius ?? 100
			return api
		},

		/**
		 * Set position on screen (top-left corner).
		 *
		 * @param {number|null} x
		 * @param {number|null} y
		 * @return Component
		 */
		setPosition( x = null, y = null ) {
			props.x = x === null ? randomInt( props.domain[ 0 ], props.domain[ 2 ] ) : x
			props.y = y === null ? randomInt( props.domain[ 1 ], props.domain[ 3 ] ) : y
			return api
		},

		/**
		 * Check if x/y coordinates (e.g. from mouse position) are within the boundaries of the vector.
		 *
		 * Note: Does not work if document scrollY|scrollX > 0!
		 *
		 * @param {number} x
		 * @param {number} y
		 */
		isPointInPath( x, y ) {
			return ctx.isPointInPath( props.path2d, x, y )
		},

		/**
		 * Check if external asset has loaded.
		 *
		 * @return Component
		 */
		async ready() {
			await svgFile
			return api
		},

		render() {
			if ( props.visible ) {
				ctx.save()
				api.applyStyles()

				if ( props.shape ) {
					createShape()
					props.path2d = new Path2D( props.path2d )
				}
				else {
					transform()
				}

				if ( props.outline ) {
					ctx.stroke( props.path2d )
				}

				if ( ! props.noFill ) {
					ctx.fill( props.path2d )
				}

				ctx.restore()
			}
		},
	} )

	function createShape() {
		props.path2d = new Path2D()

		if ( props.shape === SHAPES.rectangle ) {
			props.path2d.rect( props.x, props.y, props.width, props.height )
		}
		else if ( props.shape === SHAPES.circle ) {
			api.setRadius( props.radius )
			props.path2d.arc( props.x, props.y, props.radius, 0, 2 * Math.PI )
		}
	}

	/**
	 * Scale or translate SVG path data loaded into Path2d.
	 */
	function transform() {
		// SVG paths can only be resized using DOMMatrix.
		const mx = new Matrix( `translate(${ props.x }px, ${ props.y }px)` )

		if ( props.scale !== undefined ) {
			mx.scaleSelf( props.scale )
		}

		// Path2D paths can be transformed by DOMMatrix, but not if loaded in the constructor
		props.path2d = new Path2D()
		props.path2d.addPath( new Path2D( props.path ), mx )
	}

	api.setSize( props.width, props.height )
	api.setDomain( { autoDomainMargin: true } )

	if ( props.shape ) {
		api.setShape( props.shape )
	}

	return api
}

/**
 * Sprite component factory. Load external image or SVG file.
 *
 * @param {string} name
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D} ctx
 * @param {Parameters<typeof BaseComponent>[4] & {svg?: boolean, autoDomainMargin?: boolean} & Parameters<typeof scaleObject>[2]} config
 * @return {typeof api}
 */
function Sprite( name, canvas, ctx, config ) {
	const [ superProps, superFactory ] = BaseComponent( 'Sprite', name, canvas, ctx, config )
	const spriteLoader = SpriteLoader()

	/**
	 * @type {typeof superProps & {img: HTMLImageElement}}
	 */
	const props = Object.assign( superProps, {
		type: COMPONENTS.Sprite,
		img: undefined,
	} )

	const api = superFactory( {
		/**
		 * @param {string} url
		 * @param {{svg?: boolean, autoDomainMargin?: boolean} & Parameters<typeof scaleObject>[2]} options
		 */
		async loadSprite( url, { autoDomainMargin = true, svg = false, scaleFactor = undefined, scaleTo = undefined, fitToCanvas = undefined } ) {
			props.img = await spriteLoader.loadSprite( url, svg )

			if ( fitToCanvas ) {
				scaleObject( props.img, canvas, { fitToCanvas } )
			}
			else if ( scaleFactor ) {
				scaleObject( props.img, canvas, { scaleFactor, scaleTo } )
			}

			api.setSize( props.img.width, props.img.height )
			api.setDomain( { autoDomainMargin } )
		},

		/**
		 * @param {number} scaleFactor
		 * @param {'longest'|'shortest'|'combined'} scaleTo
		 * @return Component
		 */
		setScale( scaleFactor, scaleTo ) {
			scaleObject( props.img, canvas, { scaleFactor, scaleTo } )
			api.setSize( props.img.width, props.img.height )
			api.setDomain( { autoDomainMargin: props.autoDomainMargin } )
			return api
		},

		/**
		 * @return Component
		 */
		async ready() {
			await spriteLoader.sprite
			return api
		},

		render() {
			if ( props.visible ) {
				ctx.drawImage( props.img, props.x, props.y, props.width, props.height )
			}
		},

	} )

	/**
	 * Load image or SVG file.
	 */
	function SpriteLoader() {
		const [ sprite, setSpriteLoaded ] = resolver()

		/**
		* @param {string} url
		* @param {boolean} svg
		*/
		async function loadSprite( url, svg ) {
			const img = new Image()

			if ( svg ) {
				img.src = await loadSvg( url )
			}
			else {
				img.src = url
			}

			img.onload = () => {
				setSpriteLoaded( img )
			}

			return sprite
		}

		return {
			sprite,
			loadSprite,
		}
	}

	return api
}

/**
 * Scale an object containing height/width data.
 *
 * Options:
 *
 * [scaleFactor]: Scale relative to canvas
 *
 * [scaleTo]: Define canvas dimension used for scaling (longest, shortest, both (combined))
 *
 * @param {Record<string,any> & {width?: number, height?: number}} dimensions
 * @param {{width: number, height: number}} canvas
 * @param {{scaleFactor?: number, scaleTo?: 'longest'|'shortest'|'combined', fitToCanvas?: boolean}} options
 */
function scaleObject( dimensions, canvas, { scaleFactor = 1, scaleTo = undefined, fitToCanvas = false } ) {
	if ( dimensions.height === undefined || dimensions.width === undefined ) {
		return scaleFactor
	}

	if ( fitToCanvas ) {
		const ratio = canvas.width / canvas.height
		const long = ratio >= 1 ? 'width' : 'height'
		const short = ratio < 1 ? 'width' : 'height'
		scaleFactor = canvas[ long ] / dimensions[ long ]

		dimensions[ long ] = dimensions[ long ] * scaleFactor
		dimensions[ short ] = dimensions[ short ] * scaleFactor

		return scaleFactor
	}
	else if ( scaleTo === 'combined' ) {
		const canvasSize = canvas.width + canvas.height
		const imgSize = dimensions.width + dimensions.height
		const ratio = canvasSize / imgSize

		const scaleCoeff = scaleFactor * ratio
		dimensions.width = dimensions.width * scaleCoeff
		dimensions.height = dimensions.height * scaleCoeff
		return scaleCoeff
	}
	else if ( scaleTo ) {
		const ratio = dimensions.width / dimensions.height
		const long = ratio >= 1 ? 'width' : 'height'
		const short = ratio < 1 ? 'width' : 'height'

		const mainDim = ( scaleTo === 'shortest' && short ) || long
		const secondaryDim = ( scaleTo === 'shortest' && long ) || short

		const canvasScaleCoefficient = canvas[ mainDim ] / dimensions[ mainDim ]
		dimensions[ mainDim ] = canvas[ mainDim ] * scaleFactor
		dimensions[ secondaryDim ] = dimensions[ secondaryDim ] * scaleFactor * canvasScaleCoefficient

		return scaleFactor * canvasScaleCoefficient
	}
}
