<main>
	<div class="greeting">
		<h1>Hello {name}!</h1>
		<p>Visit the <a href="https://svelte.dev/tutorial">Svelte tutorial</a> to learn how to build Svelte apps.</p>
	</div>
	<h2>Examples:</h2>
	<ul>
		<li>
			reactive counter:
			<button on:click={() => {count += 1}}>
				count: {count}
			</button>
		</li>
		<li>
			you can acccess node modules in <code>./preload.js</code> through the <code>@electron/remote</code> module 
			<button on:click = {() => {api.hello()}}>
				hello messageBox
			</button>
			<button on:click={() => {api.fscheck()}}>
				log <code>fs</code> module into console
			</button>
		</li>
		<li>
			you can also use typescript, for example for <a href="https://sveltematerialui.com">svelte material ui</a>. just add <code>lang="ts"</code> to the component script element
		</li>
		<li>
			blazing fast hot reload: save any file in <code>/src</code>, <code>/public/index.html</code> or <code>/public/global.css</code>. <br>
			rollup will bundle & you'll see electron window reload in less than a second
		</li>
		<li>
			you can <em>probably</em> add sass/scss support pretty easily, just add the respective plugin(s) in <code>./rollup.config.js</code> and install the <code>sass</code> package
		</li>
	</ul>
	<h2>Yet to be implemented: </h2>
	<ul>
		<li>disabling dev stuff like live reload in prod</li>
	</ul>
</main>

<script lang="ts">
	const api = window.api //contextbridge api defined in preload.js
	export let name;

	let count = 0
</script>

<style>
	main {
		padding: 1em;
		max-width: 240px;
		margin: 0 auto;
		line-height: 2rem;
	}
	h1 {
		color: #ff3e00;
		text-transform: uppercase;
		font-size: 4em;
		font-weight: 100;
	}
	code {
		background: rgb(230, 230, 230);
		font: monospace;
		font-weight: bold;
		padding: 0.2rem;
		border-radius: 5px;
	}
	.greeting {
		text-align: center;
	}
	@media (min-width: 640px) {
		main {
			max-width: none;
		}
	}
</style>