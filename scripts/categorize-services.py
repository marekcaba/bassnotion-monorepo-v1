#!/usr/bin/env python3
"""
Service Categorization Script for Story 3.18.1
Applies FAANG-quality criteria to categorize playback services
"""

import csv
import json
import os

# Define categorization criteria
CATEGORIZATION_RULES = {
    # Core services that should be KEPT
    "KEEP": {
        "services": [
            "AudioEngine",
            "CorePlaybackEngine", 
            "AudioContextManager",
            "UnifiedTransportController",
            "ProfessionalTransportScheduler",
            "MusicalTimeEngine",
            "ToneInstanceManager",
            "ExerciseTimelineIntegrator",
            "MixingConsole",
            "TranspositionController",
            "LoopController"
        ],
        "keywords": ["Engine", "Transport", "Controller", "Professional", "Core"],
        "min_loc": 150,
        "description": "Professional-grade functionality with clean interfaces"
    },
    
    # Services to INTEGRATE into core services
    "INTEGRATE": {
        "services": [
            "AudioSourceManager",
            "StateManager", 
            "EventManager",
            "ToneManager",
            "AssetLoadingController",
            "TransportController"
        ],
        "keywords": ["Manager", "Controller", "Handler"],
        "max_loc": 500,
        "description": "Small, focused functionality that belongs in core services"
    },
    
    # Services to ARCHIVE for future reference
    "ARCHIVE": {
        "services": [
            "AnalyticsEngine",
            "ABTestFramework",
            "PerformanceOptimizationEngine",
            "PredictiveLoadingEngine",
            "IntelligentCacheRouter",
            "MusicalExpressionEngine"
        ],
        "keywords": ["Analytics", "Optimization", "Intelligent", "Predictive", "Advanced"],
        "description": "Over-engineered but potentially valuable at scale"
    },
    
    # Services to DELETE
    "DELETE": {
        "services": [
            "N8nPayloadProcessor",
            "N8nAssetPipelineProcessor",
            "DeviceInfoService",
            "ResourceUsageMonitor",
            "GarbageCollectionOptimizer",
            "MemoryLeakDetector"
        ],
        "keywords": ["Test", "Demo", "Garbage", "Leak"],
        "description": "Over-engineered with no clear value or duplicate functionality"
    }
}

# Widget dependencies (from our analysis)
WIDGET_DEPENDENCIES = {
    "PerformanceMonitor": ["PerformanceBaseline"],
    "HybridDrumSampleManager": ["HybridDrumKitSelector", "DrummerWidget"],
    "ExerciseTimelineIntegrator": ["ExerciseTimelineIndicator", "useWidgetPageState"],
    "ChordInstrumentProcessor": ["HarmonyWidget"],
    "AudioSampleManager": ["DrummerWidget"],
    "MusicalTimeEngine": ["Story315.integration.test", "TempoIndependentExerciseLoader", "PlaybackOrchestrator"],
    "CorePlaybackEngine": ["YouTubePlaybackSync", "PlaybackOrchestrator"]
}

def categorize_service(service_name, loc, has_dependencies=False):
    """Categorize a service based on rules and criteria"""
    
    # Check explicit service lists first
    for category, rules in CATEGORIZATION_RULES.items():
        if service_name in rules["services"]:
            return category
    
    # Check widget dependencies - services with widget deps should be kept or integrated
    if service_name in WIDGET_DEPENDENCIES:
        if loc > 500:
            return "KEEP"
        else:
            return "INTEGRATE"
    
    # Apply keyword and LOC rules
    for category, rules in CATEGORIZATION_RULES.items():
        # Check keywords
        if "keywords" in rules:
            for keyword in rules["keywords"]:
                if keyword.lower() in service_name.lower():
                    # Apply LOC constraints if any
                    if "min_loc" in rules and loc < rules["min_loc"]:
                        continue
                    if "max_loc" in rules and loc > rules["max_loc"]:
                        continue
                    return category
    
    # Default categorization based on LOC
    if loc > 1000:
        return "ARCHIVE"  # Large services might have value
    elif loc < 200:
        return "DELETE"   # Small services are likely trivial
    else:
        return "INTEGRATE"  # Medium services should be integrated

def calculate_quality_score(service_name, loc, category, has_test=False):
    """Calculate quality score (1-10) based on various factors"""
    score = 5  # Base score
    
    # Adjust based on category
    if category == "KEEP":
        score += 2
    elif category == "DELETE":
        score -= 2
    
    # Adjust based on LOC (penalize extremes)
    if 200 <= loc <= 800:
        score += 1
    elif loc > 2000 or loc < 100:
        score -= 1
    
    # Bonus for widget dependencies
    if service_name in WIDGET_DEPENDENCIES:
        score += 1
    
    # Bonus for having tests
    if has_test:
        score += 1
    
    # Ensure score is in range 1-10
    return max(1, min(10, score))

def determine_integration_target(service_name, category):
    """Determine which core service this should integrate with"""
    if category not in ["KEEP", "INTEGRATE"]:
        return "N/A"
    
    # Map based on service type
    if "Transport" in service_name or "Timeline" in service_name:
        return "TransportController"
    elif "Audio" in service_name or "Sample" in service_name or "Tone" in service_name:
        return "AudioEngine"
    elif "Plugin" in service_name or "Processor" in service_name:
        return "PluginManager"
    elif "State" in service_name or "Persistence" in service_name:
        return "ServiceRegistry"
    elif "Event" in service_name or "Sync" in service_name:
        return "EventBus"
    else:
        return "AudioEngine"  # Default

def calculate_risk_level(service_name, loc, category):
    """Calculate risk level for deletion/modification"""
    if category == "KEEP":
        return "LOW"
    
    # Check widget dependencies
    dep_count = len(WIDGET_DEPENDENCIES.get(service_name, []))
    if dep_count > 3:
        return "HIGH"
    elif dep_count > 0:
        return "MEDIUM"
    
    # Check LOC
    if loc > 1000:
        return "MEDIUM"
    
    return "LOW"

def main():
    input_file = "/Users/marekcaba/Documents/Projekty 2024/🟣 BassNotion/4. Cursor Project Folder/bassnotion-monorepo-v1/docs/2. Stories/2. 🚧 in-progress/EPIC 3/service-audit-raw-data.csv"
    output_file = "/Users/marekcaba/Documents/Projekty 2024/🟣 BassNotion/4. Cursor Project Folder/bassnotion-monorepo-v1/docs/2. Stories/2. 🚧 in-progress/EPIC 3/service-audit-categorized.csv"
    
    # Read and process the CSV
    with open(input_file, 'r') as infile, open(output_file, 'w', newline='') as outfile:
        reader = csv.DictReader(infile)
        fieldnames = reader.fieldnames
        
        writer = csv.DictWriter(outfile, fieldnames=fieldnames)
        writer.writeheader()
        
        stats = {"KEEP": 0, "INTEGRATE": 0, "ARCHIVE": 0, "DELETE": 0}
        
        for row in reader:
            service_name = row["Service Name"]
            loc = int(row["Lines of Code"])
            
            # Categorize the service
            category = categorize_service(service_name, loc)
            stats[category] += 1
            
            # Update row with categorization
            row["Category"] = category
            row["Primary Functionality"] = CATEGORIZATION_RULES[category]["description"]
            row["Widget Dependencies"] = ", ".join(WIDGET_DEPENDENCIES.get(service_name, ["None"]))
            row["Quality Score"] = calculate_quality_score(service_name, loc, category)
            row["Integration Target"] = determine_integration_target(service_name, category)
            row["Risk Level"] = calculate_risk_level(service_name, loc, category)
            row["Rationale"] = f"{category}: {CATEGORIZATION_RULES[category]['description']}"
            
            writer.writerow(row)
    
    # Print summary
    print("Service Categorization Complete!")
    print(f"Total services analyzed: {sum(stats.values())}")
    print("\nCategorization Summary:")
    for category, count in stats.items():
        print(f"  {category}: {count} services")
    print(f"\nResults saved to: {output_file}")

if __name__ == "__main__":
    main()