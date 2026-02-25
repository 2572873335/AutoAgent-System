#!/usr/bin/env python3
"""
DuckDuckGo Web Search Tool for Claude Code
使用免费的 ddgs (原 duckduckgo-search) 库进行网页搜索
"""

import argparse
import json
import sys
from ddgs import DDGS


def search(query: str, num_results: int = 10) -> list[dict]:
    """
    执行 DuckDuckGo 搜索并返回格式化结果

    Args:
        query: 搜索关键词
        num_results: 返回结果数量，默认 10

    Returns:
        包含搜索结果的列表
    """
    results = []

    try:
        with DDGS() as ddgs:
            # 执行搜索
            search_results = ddgs.text(
                query,
                max_results=num_results,
                region='us-en',  # 使用美国英文区域获取高质量英文结果
                safesearch='Moderate'
            )

            for i, item in enumerate(search_results, 1):
                result = {
                    'index': i,
                    'title': item.get('title', ''),
                    'url': item.get('href', ''),
                    'snippet': item.get('body', '')
                }
                results.append(result)

    except Exception as e:
        print(f"搜索出错: {e}", file=sys.stderr)
        return []

    return results


def format_results(results: list[dict]) -> str:
    """将搜索结果格式化为可读文本"""
    if not results:
        return "未找到相关结果。"

    output = []
    output.append(f"Search Results (Total: {len(results)}):\n")

    for item in results:
        output.append(f"[{item['index']}] {item['title']}")
        output.append(f"   Link: {item['url']}")
        output.append(f"   {item['snippet'][:150]}...")
        output.append("")

    return "\n".join(output)


def main():
    parser = argparse.ArgumentParser(
        description='DuckDuckGo Web Search Tool for Claude Code'
    )
    parser.add_argument(
        'query',
        nargs='?',
        help='搜索关键词'
    )
    parser.add_argument(
        '-n', '--num-results',
        type=int,
        default=10,
        help='返回结果数量 (默认: 10)'
    )
    parser.add_argument(
        '-j', '--json',
        action='store_true',
        help='以 JSON 格式输出'
    )

    args = parser.parse_args()

    if not args.query:
        parser.print_help()
        sys.exit(1)

    results = search(args.query, args.num_results)

    if args.json:
        # JSON 格式输出，便于程序处理
        print(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        # 人类可读格式
        print(format_results(results))

    # 返回状态码
    sys.exit(0 if results else 1)


if __name__ == '__main__':
    main()
