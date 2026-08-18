---
name: aliyun-ecs-demo-deploy
description: >-
  minikb is on Volcengine (kb.liuyidi.me via Aliyun nginx). Use when the user
  asks to 发布 minikb、kb.liuyidi.me、publish-volcengine-minikb.
  For bot.liuyidi.me use the minibot repo skill; for mlf.liuyidi.me use
  mini-langfuse Tencent deploy.
---

# minikb 发布（Volcengine）

minikb **不在**阿里云 compose。发布：本仓 workflow `Publish Volcengine Minikb`。

阿里云 Nginx：`upstream demo_kb { server 101.96.224.232:80; }`，模板在 `minikb/deploy/nginx.kb.liuyidi.me.conf.example`。  
落地页 / bot 见 minibot 仓 `deploy/`；mlf 见 mini-langfuse 仓腾讯云。

验收：`curl -fsS https://kb.liuyidi.me/health`
