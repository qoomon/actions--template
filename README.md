# actions--template
A template for creating new actions

### Usage
- Create a new repository by clicking on the 🟩 `Use this Template` button at the top right

- run `npm install`
- edit `action.yml` to adjust action metadata
- edit `README.md` to describe the action
- edit `index.ts` to implement the action
- optional - try your action localy with
  - adjust `local-run-action.ts`
  - run `npm run ts-node -- local-run-action.ts`
- commit and push your changes
  - the [Build workflow](../../actions/workflows/build.yaml) will build your changes and release them to correspondig branch automtically.
  - Then you can use your action like this e.g.
    ```yaml
      - uses: qoomon/actions--sign-commit@main
    ```
    
#### Release New Action Version
- Trigger the [Release workflow](../../actions/workflows/release.yaml)
  - The workflow will create a new release with the given version and also move the related major version tag e.g. `v1` to point to this new release
