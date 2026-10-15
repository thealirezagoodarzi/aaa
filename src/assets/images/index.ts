import concreteCubePress from './concrete_cube_press_1789296569192.jpg';
import concreteCubesLab from './concrete_cubes_lab_1789296585439.jpg';
import concreteCubesBench from './concrete_cubes_bench_1789296601349.jpg';
import companyLogo from './Logo.jpg';
import labBuildingExterior from './lab_building_exterior_1789459854548.jpg';
import modernConcreteLab from './modern_concrete_lab_1789542105981.jpg';
import exactLabHero from './exact_lab_hero_banner_1789542380933.jpg';
import heroConcreteLab from './hero_concrete_lab_1789544153827.jpg';

const concreteCubeFracture = concreteCubePress;

export const LAB_IMAGES = {
  cubePress: concreteCubePress,
  cubesLab: concreteCubesLab,
  cubesBench: concreteCubesBench,
  companyLogo: companyLogo,
  cubeFracture: concreteCubeFracture,
  building: labBuildingExterior,
  modernHeroLab: heroConcreteLab || exactLabHero || modernConcreteLab,
};
