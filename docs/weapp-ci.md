# WeChat Mini Program CI

`frontend/scripts/upload-weapp.mjs` uses `miniprogram-ci`.

Required environment variables:

- `WX_APPID`
- `WX_PRIVATE_KEY_PATH`
- `WX_ROBOT`
- `CI_VERSION`
- `CI_DESC`

Manual usage:

```bash
cd frontend
npm run build:weapp
WX_APPID=your-appid \
WX_PRIVATE_KEY_PATH=/path/to/private.key \
WX_ROBOT=1 \
npm run upload:weapp:ci
```

In GitHub Actions, `WX_PRIVATE_KEY` is written to a temporary file before upload.
