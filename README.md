# BSP Node.js Client

A [BSP] client library for Node.js.

## GitHub Packages

> ℹ️ Until https://support.github.com/ticket/personal/0/1824588 is resolved, some of the dependencies have been published
> to GitHub Packages.

### Create an .npmrc File

1. Go to [Personal access tokens (classic)].
2. Name it `GitHub Packages`.
3. Add the scope `packages:read`.
4. Click `Generate token`.
5. Create a `~/.npmrc` file with the contents:

   ```text
   //npm.pkg.github.com/:_authToken=TOKEN
   ```

   > ℹ️ Replace `TOKEN` with the token created in step 4.

### Login

Run:

```shell
yarn login --scope=@bottech --registry=https://npm.pkg.github.com
```

[bsp]: https://build-server-protocol.github.io/
[personal access tokens (classic)]: https://github.com/settings/tokens
