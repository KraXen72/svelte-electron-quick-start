var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.44.1' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\App.svelte generated by Svelte v3.44.1 */

    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	let main;
    	let div;
    	let h1;
    	let t0;
    	let t1;
    	let t2;
    	let t3;
    	let p;
    	let t4;
    	let a0;
    	let t6;
    	let t7;
    	let h20;
    	let t9;
    	let ul0;
    	let li0;
    	let t10;
    	let button0;
    	let t11;
    	let t12;
    	let t13;
    	let li1;
    	let t14;
    	let code0;
    	let t16;
    	let code1;
    	let t18;
    	let button1;
    	let t20;
    	let button2;
    	let t21;
    	let code2;
    	let t23;
    	let t24;
    	let li2;
    	let t25;
    	let a1;
    	let t27;
    	let code3;
    	let t29;
    	let t30;
    	let li3;
    	let t31;
    	let code4;
    	let t33;
    	let code5;
    	let t35;
    	let code6;
    	let t37;
    	let br;
    	let t38;
    	let t39;
    	let li4;
    	let t40;
    	let em;
    	let t42;
    	let code7;
    	let t44;
    	let code8;
    	let t46;
    	let t47;
    	let h21;
    	let t49;
    	let ul1;
    	let li5;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			main = element("main");
    			div = element("div");
    			h1 = element("h1");
    			t0 = text("Hello ");
    			t1 = text(/*name*/ ctx[0]);
    			t2 = text("!");
    			t3 = space();
    			p = element("p");
    			t4 = text("Visit the ");
    			a0 = element("a");
    			a0.textContent = "Svelte tutorial";
    			t6 = text(" to learn how to build Svelte apps.");
    			t7 = space();
    			h20 = element("h2");
    			h20.textContent = "Examples:";
    			t9 = space();
    			ul0 = element("ul");
    			li0 = element("li");
    			t10 = text("reactive counter:\r\n\t\t\t");
    			button0 = element("button");
    			t11 = text("count: ");
    			t12 = text(/*count*/ ctx[1]);
    			t13 = space();
    			li1 = element("li");
    			t14 = text("you can acccess node modules in ");
    			code0 = element("code");
    			code0.textContent = "./preload.js";
    			t16 = text(" through the ");
    			code1 = element("code");
    			code1.textContent = "@electron/remote";
    			t18 = text(" module \r\n\t\t\t");
    			button1 = element("button");
    			button1.textContent = "hello messageBox";
    			t20 = space();
    			button2 = element("button");
    			t21 = text("log ");
    			code2 = element("code");
    			code2.textContent = "fs";
    			t23 = text(" module into console");
    			t24 = space();
    			li2 = element("li");
    			t25 = text("you can also use typescript, for example for ");
    			a1 = element("a");
    			a1.textContent = "svelte material ui";
    			t27 = text(". just add ");
    			code3 = element("code");
    			code3.textContent = "lang=\"ts\"";
    			t29 = text(" to the component script element");
    			t30 = space();
    			li3 = element("li");
    			t31 = text("blazing fast hot reload: save any file in ");
    			code4 = element("code");
    			code4.textContent = "/src";
    			t33 = text(", ");
    			code5 = element("code");
    			code5.textContent = "/public/index.html";
    			t35 = text(" or ");
    			code6 = element("code");
    			code6.textContent = "/public/global.css";
    			t37 = text(". ");
    			br = element("br");
    			t38 = text("\r\n\t\t\trollup will bundle & you'll see electron window reload in less than a second");
    			t39 = space();
    			li4 = element("li");
    			t40 = text("you can ");
    			em = element("em");
    			em.textContent = "probably";
    			t42 = text(" add sass/scss support pretty easily, just add the respective plugin(s) in ");
    			code7 = element("code");
    			code7.textContent = "./rollup.config.js";
    			t44 = text(" and install the ");
    			code8 = element("code");
    			code8.textContent = "sass";
    			t46 = text(" package");
    			t47 = space();
    			h21 = element("h2");
    			h21.textContent = "Yet to be implemented:";
    			t49 = space();
    			ul1 = element("ul");
    			li5 = element("li");
    			li5.textContent = "disabling dev stuff like live reload in prod";
    			attr_dev(h1, "class", "svelte-a2756s");
    			add_location(h1, file, 2, 2, 35);
    			attr_dev(a0, "href", "https://svelte.dev/tutorial");
    			add_location(a0, file, 3, 15, 74);
    			add_location(p, file, 3, 2, 61);
    			attr_dev(div, "class", "greeting svelte-a2756s");
    			add_location(div, file, 1, 1, 9);
    			add_location(h20, file, 5, 1, 182);
    			add_location(button0, file, 9, 3, 242);
    			add_location(li0, file, 7, 2, 211);
    			attr_dev(code0, "class", "svelte-a2756s");
    			add_location(code0, file, 14, 35, 368);
    			attr_dev(code1, "class", "svelte-a2756s");
    			add_location(code1, file, 14, 73, 406);
    			add_location(button1, file, 15, 3, 448);
    			attr_dev(code2, "class", "svelte-a2756s");
    			add_location(code2, file, 19, 8, 581);
    			add_location(button2, file, 18, 3, 530);
    			add_location(li1, file, 13, 2, 327);
    			attr_dev(a1, "href", "https://sveltematerialui.com");
    			add_location(a1, file, 23, 48, 697);
    			attr_dev(code3, "class", "svelte-a2756s");
    			add_location(code3, file, 23, 120, 769);
    			add_location(li2, file, 22, 2, 643);
    			attr_dev(code4, "class", "svelte-a2756s");
    			add_location(code4, file, 26, 45, 887);
    			attr_dev(code5, "class", "svelte-a2756s");
    			add_location(code5, file, 26, 64, 906);
    			attr_dev(code6, "class", "svelte-a2756s");
    			add_location(code6, file, 26, 99, 941);
    			add_location(br, file, 26, 132, 974);
    			add_location(li3, file, 25, 2, 836);
    			add_location(em, file, 30, 11, 1089);
    			attr_dev(code7, "class", "svelte-a2756s");
    			add_location(code7, file, 30, 103, 1181);
    			attr_dev(code8, "class", "svelte-a2756s");
    			add_location(code8, file, 30, 151, 1229);
    			add_location(li4, file, 29, 2, 1072);
    			add_location(ul0, file, 6, 1, 203);
    			add_location(h21, file, 33, 1, 1274);
    			add_location(li5, file, 35, 2, 1317);
    			add_location(ul1, file, 34, 1, 1309);
    			attr_dev(main, "class", "svelte-a2756s");
    			add_location(main, file, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div);
    			append_dev(div, h1);
    			append_dev(h1, t0);
    			append_dev(h1, t1);
    			append_dev(h1, t2);
    			append_dev(div, t3);
    			append_dev(div, p);
    			append_dev(p, t4);
    			append_dev(p, a0);
    			append_dev(p, t6);
    			append_dev(main, t7);
    			append_dev(main, h20);
    			append_dev(main, t9);
    			append_dev(main, ul0);
    			append_dev(ul0, li0);
    			append_dev(li0, t10);
    			append_dev(li0, button0);
    			append_dev(button0, t11);
    			append_dev(button0, t12);
    			append_dev(ul0, t13);
    			append_dev(ul0, li1);
    			append_dev(li1, t14);
    			append_dev(li1, code0);
    			append_dev(li1, t16);
    			append_dev(li1, code1);
    			append_dev(li1, t18);
    			append_dev(li1, button1);
    			append_dev(li1, t20);
    			append_dev(li1, button2);
    			append_dev(button2, t21);
    			append_dev(button2, code2);
    			append_dev(button2, t23);
    			append_dev(ul0, t24);
    			append_dev(ul0, li2);
    			append_dev(li2, t25);
    			append_dev(li2, a1);
    			append_dev(li2, t27);
    			append_dev(li2, code3);
    			append_dev(li2, t29);
    			append_dev(ul0, t30);
    			append_dev(ul0, li3);
    			append_dev(li3, t31);
    			append_dev(li3, code4);
    			append_dev(li3, t33);
    			append_dev(li3, code5);
    			append_dev(li3, t35);
    			append_dev(li3, code6);
    			append_dev(li3, t37);
    			append_dev(li3, br);
    			append_dev(li3, t38);
    			append_dev(ul0, t39);
    			append_dev(ul0, li4);
    			append_dev(li4, t40);
    			append_dev(li4, em);
    			append_dev(li4, t42);
    			append_dev(li4, code7);
    			append_dev(li4, t44);
    			append_dev(li4, code8);
    			append_dev(li4, t46);
    			append_dev(main, t47);
    			append_dev(main, h21);
    			append_dev(main, t49);
    			append_dev(main, ul1);
    			append_dev(ul1, li5);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*click_handler*/ ctx[3], false, false, false),
    					listen_dev(button1, "click", /*click_handler_1*/ ctx[4], false, false, false),
    					listen_dev(button2, "click", /*click_handler_2*/ ctx[5], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*name*/ 1) set_data_dev(t1, /*name*/ ctx[0]);
    			if (dirty & /*count*/ 2) set_data_dev(t12, /*count*/ ctx[1]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	const api = window.api; //contextbridge api defined in preload.js
    	let { name } = $$props;
    	let count = 0;
    	const writable_props = ['name'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => {
    		$$invalidate(1, count += 1);
    	};

    	const click_handler_1 = () => {
    		api.hello();
    	};

    	const click_handler_2 = () => {
    		api.fscheck();
    	};

    	$$self.$$set = $$props => {
    		if ('name' in $$props) $$invalidate(0, name = $$props.name);
    	};

    	$$self.$capture_state = () => ({ api, name, count });

    	$$self.$inject_state = $$props => {
    		if ('name' in $$props) $$invalidate(0, name = $$props.name);
    		if ('count' in $$props) $$invalidate(1, count = $$props.count);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [name, count, api, click_handler, click_handler_1, click_handler_2];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { name: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*name*/ ctx[0] === undefined && !('name' in props)) {
    			console.warn("<App> was created without expected prop 'name'");
    		}
    	}

    	get name() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
