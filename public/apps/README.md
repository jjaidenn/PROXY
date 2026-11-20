# PROXY internal apps

Place each first-party app in its own folder under `public/apps/` and give it an `index.html` entry point.

Example:

```
public/
  apps/
    index.html
    demo/
      index.html
      assets/
```

Open the directory with `proxy://apps` and an app with `proxy://demo` in the PROXY address bar. These are same-origin routes, so they load inside the existing PROXY frame without opening a new tab.

Only add content you own or are authorized to host. This does not turn PROXY into a general-purpose external-site proxy and does not override another site's embedding or access restrictions.
