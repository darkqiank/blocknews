import os
import sys
import importlib
from pathlib import Path
from typing import List, Dict, Any, Tuple
import json


class ModuleDiscovery:
    """动态发现和加载news模块"""
    
    def __init__(self, news_dir: str = "news_spider/news"):
        self.news_dir = Path(news_dir)
        self.modules = {}
        
    def discover_modules(self) -> List[Dict[str, Any]]:
        """发现所有可用的news模块"""
        modules = []
        
        if not self.news_dir.exists():
            print(f"News目录不存在: {self.news_dir}")
            return modules
        
        for item in self.news_dir.iterdir():
            if item.is_dir() and (item / "__init__.py").exists():
                module_info = self._get_module_info(item)
                if module_info:
                    modules.append(module_info)
                    print(f"发现模块: {module_info['name']} - {module_info['base_name']}")
        
        return modules
    
    def _get_module_info(self, module_path: Path) -> Dict[str, Any]:
        """获取模块信息"""
        try:
            module_name = module_path.name
            
            # 临时添加路径到sys.path
            parent_path = str(module_path.parent.absolute())
            if parent_path not in sys.path:
                sys.path.insert(0, parent_path)
            
            # 导入模块
            module = importlib.import_module(module_name)
            
            # 获取模块基本信息
            info = {
                'name': module_name,
                'path': str(module_path),
                'base_name': getattr(module, 'BASE_NAME', module_name),
                'base_url': getattr(module, 'BASE_URL', ''),
                'base_netloc': getattr(module, 'BASE_NETLOC', ''),
                'module': module
            }
            
            # 检查发布信息
            publish_info_path = module_path / "publish_info.json"
            if publish_info_path.exists():
                try:
                    with open(publish_info_path, 'r', encoding='utf-8') as f:
                        publish_info = json.load(f)
                        info['publish_info'] = publish_info
                except Exception as e:
                    print(f"读取发布信息失败 {module_name}: {e}")
            
            # 检查模块是否有必要的函数
            required_functions = ['get_links', 'get_content', 'fetch_url']
            missing_functions = []
            
            for func_name in required_functions:
                if not hasattr(module, func_name):
                    missing_functions.append(func_name)
            
            if missing_functions:
                print(f"模块 {module_name} 缺少必要函数: {missing_functions}")
                return None
            
            info['functions'] = {
                'get_links': getattr(module, 'get_links'),
                'get_content': getattr(module, 'get_content'),
                'fetch_url': getattr(module, 'fetch_url'),
                'a_fetch_url': getattr(module, 'a_fetch_url', None)
            }
            
            self.modules[module_name] = info
            return info
            
        except Exception as e:
            print(f"加载模块失败 {module_path.name}: {e}")
            return None
    
    def get_module(self, module_name: str) -> Dict[str, Any]:
        """获取指定模块"""
        return self.modules.get(module_name)
    
    def list_modules(self) -> List[str]:
        """列出所有模块名称"""
        return list(self.modules.keys())
    
    def validate_module(self, module_name: str) -> Tuple[bool, List[str]]:
        """验证模块是否完整"""
        module_info = self.get_module(module_name)
        if not module_info:
            return False, [f"模块 {module_name} 不存在"]
        
        errors = []
        
        # 检查基本配置
        if not module_info.get('base_url'):
            errors.append("缺少 BASE_URL 配置")
        
        if not module_info.get('base_netloc'):
            errors.append("缺少 BASE_NETLOC 配置")
        
        # 检查函数是否可调用
        functions = module_info.get('functions', {})
        for func_name, func in functions.items():
            if func is None and func_name != 'a_fetch_url':  # a_fetch_url是可选的
                errors.append(f"缺少函数: {func_name}")
            elif func and not callable(func):
                errors.append(f"函数 {func_name} 不可调用")
        
        return len(errors) == 0, errors
    
    def test_module_connectivity(self, module_name: str) -> Tuple[bool, str]:
        """测试模块连接性"""
        module_info = self.get_module(module_name)
        if not module_info:
            return False, f"模块 {module_name} 不存在"
        
        try:
            fetch_url = module_info['functions']['fetch_url']
            base_url = module_info['base_url']
            
            print(f"测试模块 {module_name} 连接性...")
            content = fetch_url(base_url)
            
            if content:
                return True, f"连接成功，获取到 {len(content)} 字符的内容"
            else:
                return False, "无法获取内容"
                
        except Exception as e:
            return False, f"连接测试失败: {e}"
    
    def get_module_statistics(self) -> Dict[str, Any]:
        """获取模块统计信息"""
        total_modules = len(self.modules)
        valid_modules = 0
        invalid_modules = []
        
        for module_name in self.modules:
            is_valid, errors = self.validate_module(module_name)
            if is_valid:
                valid_modules += 1
            else:
                invalid_modules.append({
                    'name': module_name,
                    'errors': errors
                })
        
        return {
            'total_modules': total_modules,
            'valid_modules': valid_modules,
            'invalid_modules': invalid_modules,
            'module_list': list(self.modules.keys())
        }


def discover_and_validate_modules(news_dir: str = "news_spider/news") -> ModuleDiscovery:
    """发现并验证所有模块的便捷函数"""
    discovery = ModuleDiscovery(news_dir)
    modules = discovery.discover_modules()
    
    print(f"\n=== 模块发现结果 ===")
    print(f"发现 {len(modules)} 个模块")
    
    for module_info in modules:
        module_name = module_info['name']
        is_valid, errors = discovery.validate_module(module_name)
        
        print(f"\n模块: {module_name}")
        print(f"  名称: {module_info['base_name']}")
        print(f"  URL: {module_info['base_url']}")
        print(f"  状态: {'✓ 有效' if is_valid else '✗ 无效'}")
        
        if errors:
            print(f"  错误: {', '.join(errors)}")
    
    # 显示统计信息
    stats = discovery.get_module_statistics()
    print(f"\n=== 统计信息 ===")
    print(f"总模块数: {stats['total_modules']}")
    print(f"有效模块: {stats['valid_modules']}")
    print(f"无效模块: {len(stats['invalid_modules'])}")
    
    return discovery


if __name__ == "__main__":
    # 测试模块发现功能
    discovery = discover_and_validate_modules()
    
    # 测试连接性
    print(f"\n=== 连接性测试 ===")
    for module_name in discovery.list_modules():
        is_valid, _ = discovery.validate_module(module_name)
        if is_valid:
            success, message = discovery.test_module_connectivity(module_name)
            print(f"{module_name}: {'✓' if success else '✗'} {message}")
