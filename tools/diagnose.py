#!/usr/bin/env python3
"""
Kimi Agent 项目问题诊断与解决 Skill

用法:
  python tools/diagnose.py [选项]

示例:
  python tools/diagnose.py                    # 全面诊断
  python tools/diagnose.py --check-api        # 仅检查 API
  python tools/diagnose.py --check-search     # 仅检查搜索功能
  python tools/diagnose.py --fix-search       # 修复搜索问题
"""

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path


# 项目根目录
PROJECT_ROOT = Path(__file__).parent.parent.absolute()


def check_python_version():
    """检查 Python 版本"""
    version = sys.version_info
    print(f"\n[CHECK] Python 版本: {version.major}.{version.minor}.{version.micro}")
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print("   [WARN]  建议使用 Python 3.8+")
        return False
    print("   [OK] Python 版本正常")
    return True


def check_node_version():
    """检查 Node.js 版本"""
    try:
        result = subprocess.run(
            ["node", "--version"],
            capture_output=True,
            text=True,
            timeout=10
        )
        version = result.stdout.strip()
        print(f"\n[CHECK] Node.js 版本: {version}")
        print("   [OK] Node.js 已安装")
        return True
    except FileNotFoundError:
        print("\n[WARN]  Node.js 未安装")
        return False
    except Exception as e:
        print(f"\n[WARN]  Node.js 检查失败: {e}")
        return False


def check_npm_packages():
    """检查 npm 依赖"""
    print("\n[CHECK] 检查 npm 依赖...")
    node_modules = PROJECT_ROOT / "node_modules"
    if node_modules.exists():
        print("   [OK] node_modules 存在")
        return True
    else:
        print("   [WARN]  node_modules 不存在，需要运行 npm install")
        return False


def check_env_file():
    """检查环境变量配置"""
    print("\n[CHECK] 检查 .env 文件...")
    env_file = PROJECT_ROOT / ".env"

    if not env_file.exists():
        print("   [WARN]  .env 文件不存在")
        print(f"   [HINT] 请复制 .env.example 为 .env 并配置")
        return False

    # 读取配置
    with open(env_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # 检查关键配置
    has_api_key = "DEEPSEEK_API_KEY=" in content and "your-" not in content
    has_port = "PORT=" in content
    has_vite_url = "VITE_API_URL=" in content

    if has_api_key:
        print("   [OK] DeepSeek API Key 已配置")
    else:
        print("   [WARN]  DeepSeek API Key 未配置")

    if has_port:
        print("   [OK] PORT 已配置")
    else:
        print("   [WARN]  PORT 未配置")

    if has_vite_url:
        print("   [OK] VITE_API_URL 已配置")
    else:
        print("   [WARN]  VITE_API_URL 未配置")

    return has_api_key


def check_service_running(port, name):
    """检查服务是否运行"""
    try:
        import urllib.request
        url = f"http://localhost:{port}/api/health"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read())
            print(f"   [OK] {name} 运行正常 (端口 {port})")
            return True
    except Exception as e:
        print(f"   [FAIL] {name} 未运行 (端口 {port}): {e}")
        return False


def check_api_health():
    """检查后端 API 健康状态"""
    print("\n[CHECK] 检查后端 API...")
    return check_service_running(3001, "后端 API")


def check_frontend():
    """检查前端服务"""
    print("\n[CHECK] 检查前端服务...")
    return check_service_running(5173, "前端服务")


def test_search_api():
    """测试搜索 API"""
    print("\n[CHECK] 测试搜索 API...")
    try:
        import urllib.request
        import urllib.parse

        url = "http://localhost:3001/api/search"
        data = json.dumps({"query": "test", "numResults": 2}).encode('utf-8')
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"}
        )

        with urllib.request.urlopen(req, timeout=30) as response:
            result = json.loads(response.read())
            if result.get("success"):
                # 检查结果是否为英文
                results = result.get("results", [])
                if results:
                    first_title = results[0].get("title", "")
                    # 检查是否包含中文字符
                    has_chinese = any('\u4e00' <= c <= '\u9fff' for c in first_title)
                    if has_chinese:
                        print("   [WARN]  搜索返回中文结果（可能是 Bing 区域问题）")
                        print("   [HINT] 建议使用 tools/search_tool.py 进行英文搜索")
                    else:
                        print("   [OK] 搜索 API 正常")
                    return True
            print("   [WARN]  搜索 API 返回异常结果")
            return False
    except Exception as e:
        print(f"   [FAIL] 搜索 API 测试失败: {e}")
        return False


def check_ddgs_installed():
    """检查 ddgs 库是否安装"""
    print("\n[CHECK] 检查 ddgs (DuckDuckGo) 库...")
    try:
        import ddgs
        print("   [OK] ddgs 已安装")
        return True
    except ImportError:
        print("   [FAIL] ddgs 未安装")
        print("   [HINT] 运行: pip install ddgs")
        return False


def test_ddgs_search():
    """测试 ddgs 搜索"""
    print("\n[CHECK] 测试 ddgs 搜索...")
    try:
        from ddgs import DDGS

        with DDGS() as ddgs:
            results = list(ddgs.text("test", max_results=2))
            if results:
                print("   [OK] ddgs 搜索正常")
                return True
            else:
                print("   [WARN]  ddgs 搜索无结果")
                return False
    except Exception as e:
        print(f"   [FAIL] ddgs 搜索失败: {e}")
        return False


def fix_ddgs_installation():
    """修复 ddgs 安装"""
    print("\n[FIX] 修复 ddgs 安装...")
    print("   执行: pip install ddgs")

    result = subprocess.run(
        ["pip", "install", "ddgs"],
        capture_output=True,
        text=True
    )

    if result.returncode == 0:
        print("   [OK] ddgs 安装成功")
        return True
    else:
        print(f"   [FAIL] 安装失败: {result.stderr}")
        return False


def start_services():
    """启动服务"""
    print("\n[START] 启动服务...")
    print("   执行: npm run dev")
    print("   (服务将在后台运行)")

    # 检查是否已在运行
    if check_service_running(3001, "后端"):
        print("   [INFO]  服务已在运行")
        return True

    # 启动服务
    subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=str(PROJECT_ROOT),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == 'win32' else 0
    )

    print("   [OK] 服务启动中...")
    print("   [HINT] 等待 5 秒后检查...")
    time.sleep(5)

    return check_service_running(3001, "后端")


def run_full_diagnosis():
    """运行全面诊断"""
    print("=" * 50)
    print("[DIAGNOSIS] Kimi Agent Project Diagnosis")
    print("=" * 50)

    results = {
        "python": check_python_version(),
        "node": check_node_version(),
        "npm": check_npm_packages(),
        "env": check_env_file(),
        "api": check_api_health(),
        "frontend": check_frontend(),
        "ddgs": check_ddgs_installed(),
    }

    # 如果服务运行，测试搜索
    if results.get("api"):
        results["search_api"] = test_search_api()

    # 如果 ddgs 已安装，测试搜索
    if results.get("ddgs"):
        results["ddgs_search"] = test_ddgs_search()

    print("\n" + "=" * 50)
    print("[SUMMARY] 诊断结果汇总")
    print("=" * 50)

    for key, value in results.items():
        status = "[OK]" if value else "[FAIL]"
        print(f"  {status} {key}")

    # 建议
    print("\n[HINT] 建议:")
    if not results.get("env"):
        print("   1. 配置 .env 文件中的 DEEPSEEK_API_KEY")
    if not results.get("api") or not results.get("frontend"):
        print("   2. 运行 npm run dev 启动服务")
    if results.get("search_api") is False:
        print("   3. 使用 tools/search_tool.py 替代后端搜索 API")
    if not results.get("ddgs"):
        print("   4. 运行 pip install ddgs 安装搜索库")

    return all(v for k, v in results.items() if k not in ["search_api", "ddgs_search"])


def main():
    parser = argparse.ArgumentParser(
        description="Kimi Agent 项目问题诊断与解决工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python tools/diagnose.py                    全面诊断
  python tools/diagnose.py --check-api         检查 API
  python tools/diagnose.py --check-search      检查搜索
  python tools/diagnose.py --start             启动服务
  python tools/diagnose.py --fix-ddgs          修复 ddgs
        """
    )

    parser.add_argument(
        "--check-api",
        action="store_true",
        help="仅检查 API 服务"
    )
    parser.add_argument(
        "--check-search",
        action="store_true",
        help="仅检查搜索功能"
    )
    parser.add_argument(
        "--start",
        action="store_true",
        help="启动服务"
    )
    parser.add_argument(
        "--fix-ddgs",
        action="store_true",
        help="修复 ddgs 安装"
    )
    parser.add_argument(
        "--fix-search",
        action="store_true",
        help="修复搜索问题（安装 ddgs）"
    )

    args = parser.parse_args()

    if args.check_api:
        check_python_version()
        check_env_file()
        check_api_health()
        check_frontend()
    elif args.check_search:
        check_ddgs_installed()
        test_ddgs_search()
    elif args.start:
        start_services()
    elif args.fix_ddgs or args.fix_search:
        fix_ddgs_installation()
        test_ddgs_search()
    else:
        run_full_diagnosis()


if __name__ == "__main__":
    main()
